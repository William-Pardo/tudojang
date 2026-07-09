const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

const projectId = "demo-tudojang";
let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.resolve(__dirname, "..", "..", "firestore.rules"),
        "utf8"
      ),
    },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "user-1"), {
      tenantId: "tenant-1",
      email: "gengepardo@gmail.com",
      rol: "Admin",
    });
    await setDoc(doc(context.firestore(), "usuarios", "user-2"), {
      tenantId: "tenant-2",
      email: "otro@test.com",
      rol: "Admin",
    });
    await setDoc(doc(context.firestore(), "tenants", "tenant-1"), {
      tenantId: "tenant-1",
      slug: "tudojang",
      nombreClub: "Tudojang",
    });
    await setDoc(doc(context.firestore(), "tickets_soporte", "ticket-1"), {
      userId: "user-1",
      tenantId: "tenant-1",
      category: "estudiantes",
      summary: "Resumen mínimo",
      source: "local",
      status: "open",
    });
  });
});

test.after(async () => {
  await environment.cleanup();
});

const client = (uid, tenantId, rol, extraClaims = {}) =>
  environment.authenticatedContext(uid, { tenantId, rol, ...extraClaims }).firestore();

test("authenticated user can read own profile and admin can read team profiles", async () => {
  const adminDb = client("user-1", "tenant-1", "Admin");
  const ownSnapshot = await assertSucceeds(
    getDoc(doc(adminDb, "usuarios", "user-1"))
  );
  assert.equal(ownSnapshot.data().email, "gengepardo@gmail.com");

  await assertSucceeds(
    getDoc(doc(adminDb, "usuarios", "user-2"))
  );
});

test("student cannot read another user profile", async () => {
  await assertFails(
    getDoc(doc(client("est-1", "tenant-1", "Estudiante"), "usuarios", "user-1"))
  );
});

test("admin can list legacy root collections needed by DataContext startup", async () => {
  const db = client("user-1", "tenant-1", "Admin");

  await assertSucceeds(getDocs(collection(db, "usuarios")));
  await assertSucceeds(getDocs(collection(db, "sedes")));
  await assertSucceeds(getDocs(collection(db, "estudiantes")));
  await assertSucceeds(getDocs(collection(db, "programas")));
});

test("student cannot list legacy admin collections", async () => {
  const db = client("est-1", "tenant-1", "Estudiante");

  await assertFails(getDocs(collection(db, "usuarios")));
  await assertFails(getDocs(collection(db, "estudiantes")));
});

test("ticket owner in the same tenant can read the ticket", async () => {
  const snapshot = await assertSucceeds(
    getDoc(doc(client("user-1", "tenant-1", "Admin"), "tickets_soporte", "ticket-1"))
  );
  assert.equal(snapshot.data().summary, "Resumen mínimo");
});

test("another tenant cannot read or infer the ticket", async () => {
  await assertFails(
    getDoc(doc(client("user-2", "tenant-2", "Admin"), "tickets_soporte", "ticket-1"))
  );
});

test("SuperAdmin can read tickets across tenants", async () => {
  const snapshot = await assertSucceeds(
    getDoc(doc(client("master-1", "master", "SuperAdmin"), "tickets_soporte", "ticket-1"))
  );
  assert.equal(snapshot.data().tenantId, "tenant-1");
});

test("ordinary clients cannot create or update tickets", async () => {
  const db = client("user-1", "tenant-1", "Admin");
  await assertFails(
    setDoc(doc(db, "tickets_soporte", "ticket-2"), {
      userId: "user-1",
      tenantId: "tenant-1",
      summary: "Intento directo",
    })
  );
  await assertFails(
    updateDoc(doc(db, "tickets_soporte", "ticket-1"), {
      status: "resolved",
    })
  );
});

test("even SuperAdmin cannot mutate tickets directly from the client", async () => {
  await assertFails(
    updateDoc(
      doc(
        client("master-1", "master", "SuperAdmin"),
        "tickets_soporte",
        "ticket-1"
      ),
      { status: "resolved" }
    )
  );
});

test("clients cannot write quota documents", async () => {
  await assertFails(
    setDoc(
      doc(
        client("user-1", "tenant-1", "Admin"),
        "asistente_cuotas",
        "user__user-1__2026-06"
      ),
      { usedMicros: 0 }
    )
  );
});

test("student can write own academic progress on real progress path", async () => {
  const db = client("est-1", "tenant-1", "Estudiante");

  await assertSucceeds(
    setDoc(
      doc(db, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    )
  );
});

test("tutor cannot write student academic progress but can read it in same tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "vinculos", "tutor@test.com_est-1"),
      {
        tenantId: "tenant-1",
        tutorEmail: "tutor@test.com",
        estudianteId: "est-1",
      }
    );
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    );
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "tutor@test.com" });

  const snapshot = await assertSucceeds(
    getDoc(doc(tutorDb, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"))
  );
  assert.deepEqual(snapshot.data().paginasVistas, [1, 2]);

  await assertFails(
    setDoc(
      doc(tutorDb, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2, 3],
        segundosUnicos: [],
      }
    )
  );
});

test("instructor can create academic assignment with jornadaId in their own tenant", async () => {
  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertSucceeds(
    setDoc(
      doc(instructorDb, "tenants", "tenant-1", "asignaciones", "asignacion-recurso-1-jornada-1"),
      {
        tenantId: "tenant-1",
        recursoId: "recurso-1",
        jornadaId: "jornada-1",
        titulo: "Material tecnico",
        destinatario: { tipo: "grupo", grupo: "Infantil" },
        uso: "estudio",
        momento: "preparacion",
        obligatoria: true,
        fechaApertura: "2026-06-27T00:00:00.000Z",
        estado: "publicada",
        creadoPorUid: "maestro-1",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    )
  );
});

test("instructor from another tenant cannot read or write an academic assignment with jornadaId", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "asignaciones", "asignacion-recurso-1-jornada-1"),
      {
        tenantId: "tenant-1",
        recursoId: "recurso-1",
        jornadaId: "jornada-1",
        titulo: "Material tecnico",
        destinatario: { tipo: "grupo", grupo: "Infantil" },
        uso: "estudio",
        momento: "preparacion",
        obligatoria: true,
        fechaApertura: "2026-06-27T00:00:00.000Z",
        estado: "publicada",
        creadoPorUid: "maestro-1",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    );
  });

  const otroTenantDb = client("maestro-2", "tenant-2", "Editor");

  await assertFails(
    getDoc(doc(otroTenantDb, "tenants", "tenant-1", "asignaciones", "asignacion-recurso-1-jornada-1"))
  );

  await assertFails(
    setDoc(
      doc(otroTenantDb, "tenants", "tenant-1", "asignaciones", "asignacion-recurso-2-jornada-1"),
      {
        tenantId: "tenant-1",
        recursoId: "recurso-2",
        jornadaId: "jornada-1",
        titulo: "Otro material",
        destinatario: { tipo: "grupo", grupo: "Infantil" },
        uso: "estudio",
        momento: "preparacion",
        obligatoria: true,
        fechaApertura: "2026-06-27T00:00:00.000Z",
        estado: "publicada",
        creadoPorUid: "maestro-2",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    )
  );
});

test("instructor (Editor) can delete an academic assignment in their own tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "asignaciones", "asignacion-a-eliminar"),
      {
        tenantId: "tenant-1",
        recursoId: "recurso-1",
        jornadaId: "jornada-1",
        titulo: "Material tecnico",
        destinatario: { tipo: "grupo", grupo: "Infantil" },
        uso: "estudio",
        momento: "preparacion",
        obligatoria: true,
        fechaApertura: "2026-06-27T00:00:00.000Z",
        estado: "publicada",
        creadoPorUid: "maestro-1",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    );
  });

  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertSucceeds(
    deleteDoc(doc(instructorDb, "tenants", "tenant-1", "asignaciones", "asignacion-a-eliminar"))
  );
});

test("instructor (Editor) from another tenant cannot delete an academic assignment", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "asignaciones", "asignacion-protegida"),
      {
        tenantId: "tenant-1",
        recursoId: "recurso-1",
        jornadaId: "jornada-1",
        titulo: "Material tecnico",
        destinatario: { tipo: "grupo", grupo: "Infantil" },
        uso: "estudio",
        momento: "preparacion",
        obligatoria: true,
        fechaApertura: "2026-06-27T00:00:00.000Z",
        estado: "publicada",
        creadoPorUid: "maestro-1",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    );
  });

  const otroTenantDb = client("maestro-2", "tenant-2", "Editor");

  await assertFails(
    deleteDoc(doc(otroTenantDb, "tenants", "tenant-1", "asignaciones", "asignacion-protegida"))
  );
});

// =========================================================================
// Jornadas de instrucción — permiso "maestro asignado" (subtarea 12.2)
// El maestro asignado se identifica por resource.data.instructorId == request.auth.uid.
// No existe un rol "Maestro" separado: Editor/Asistente solo pueden editar la
// jornada donde estén asignados; Admin/SuperAdmin pueden editar cualquiera del tenant.
// =========================================================================

const JORNADA_ASIGNADA = {
  tenantId: "tenant-1",
  programaId: "programa-1",
  ejecucionProgramaId: "ejecucion-1",
  grupoId: "grupo-infantil",
  sedeId: "sede-principal",
  espacioId: "tatami-1",
  instructorId: "maestro-asignado",
  fecha: "2026-07-06",
  horaInicio: "08:00",
  horaFin: "09:00",
  estado: "confirmada",
  objetivosPlaneados: [],
  objetivosImpartidos: [],
  asistenciaRegistrada: false,
  creadoEn: "2026-07-01T00:00:00.000Z",
  actualizadoEn: "2026-07-01T00:00:00.000Z",
};

async function seedJornadaAsignada() {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "jornadas", "jornada-1"),
      JORNADA_ASIGNADA
    );
  });
}

test("assigned instructor can update their own jornada", async () => {
  await seedJornadaAsignada();

  const asignadoDb = client("maestro-asignado", "tenant-1", "Editor");

  await assertSucceeds(
    updateDoc(doc(asignadoDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("assigned instructor can cancel their own jornada", async () => {
  await seedJornadaAsignada();

  const asignadoDb = client("maestro-asignado", "tenant-1", "Asistente");

  await assertSucceeds(
    updateDoc(doc(asignadoDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "cancelada",
      motivoCancelacion: "Feriado nacional",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("non-assigned instructor cannot update another instructor's jornada", async () => {
  await seedJornadaAsignada();

  const intrusoDb = client("maestro-otro", "tenant-1", "Editor");

  await assertFails(
    updateDoc(doc(intrusoDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("non-assigned instructor cannot cancel another instructor's jornada", async () => {
  await seedJornadaAsignada();

  const intrusoDb = client("maestro-otro", "tenant-1", "Asistente");

  await assertFails(
    updateDoc(doc(intrusoDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "cancelada",
      motivoCancelacion: "Robando la clase ajena",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("admin can update any jornada in their tenant regardless of instructorId", async () => {
  await seedJornadaAsignada();

  const adminDb = client("user-1", "tenant-1", "Admin");

  await assertSucceeds(
    updateDoc(doc(adminDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("student cannot update a jornada", async () => {
  await seedJornadaAsignada();

  const estudianteDb = client("est-1", "tenant-1", "Estudiante");

  await assertFails(
    updateDoc(doc(estudianteDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("unlinked tutor cannot read student academic progress", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    );
  });

  await assertFails(
    getDoc(
      doc(
        client("tutor-2", "tenant-1", "Tutor", { email: "otro@test.com" }),
        "tenants",
        "tenant-1",
        "progreso",
        "est-1",
        "asignaciones",
        "asig-1"
      )
    )
  );
});

// Fase 0 (roster explicito de matricula): tenants/{t}/ejecucionesPrograma/{e}/inscripciones/{estudianteId}
const inscripcionPath = (db, tenantId, ejecucionId, estudianteId) => doc(
  db, "tenants", tenantId, "ejecucionesPrograma", ejecucionId, "inscripciones", estudianteId
);

test("instructor can enroll (create) a student into a roster in their own tenant", async () => {
  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertSucceeds(
    setDoc(inscripcionPath(instructorDb, "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-1",
    })
  );
});

test("instructor can withdraw (delete) a student from a roster in their own tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(inscripcionPath(context.firestore(), "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-1",
    });
  });

  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertSucceeds(
    deleteDoc(inscripcionPath(instructorDb, "tenant-1", "ejecucion-1", "estudiante-1"))
  );
});

test("cross-tenant enrollment is denied even for an instructor role", async () => {
  const otroTenantDb = client("maestro-2", "tenant-2", "Editor");

  await assertFails(
    setDoc(inscripcionPath(otroTenantDb, "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-2",
    })
  );
});

test("student and tutor roles cannot enroll students into a roster", async () => {
  await assertFails(
    setDoc(inscripcionPath(client("est-1", "tenant-1", "Estudiante"), "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "est-1",
    })
  );

  await assertFails(
    setDoc(inscripcionPath(client("tutor-1", "tenant-1", "Tutor"), "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "tutor-1",
    })
  );
});

test("tutor role can never read the enrollment roster (relaciones academicas sensibles)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(inscripcionPath(context.firestore(), "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-1",
    });
  });

  await assertFails(
    getDoc(inscripcionPath(client("tutor-1", "tenant-1", "Tutor"), "tenant-1", "ejecucion-1", "estudiante-1"))
  );
});

test("enrollment create is rejected when estudianteId/tenantId in the document do not match the path", async () => {
  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertFails(
    setDoc(inscripcionPath(instructorDb, "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "otro-estudiante",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-1",
    })
  );
});

test("enrollment roster cannot be updated directly (re-enroll requires delete + create)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(inscripcionPath(context.firestore(), "tenant-1", "ejecucion-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      ejecucionProgramaId: "ejecucion-1",
      tenantId: "tenant-1",
      estado: "activa",
      fechaInscripcion: "2026-07-08T00:00:00.000Z",
      inscritoPorUid: "maestro-1",
    });
  });

  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertFails(
    updateDoc(inscripcionPath(instructorDb, "tenant-1", "ejecucion-1", "estudiante-1"), {
      estado: "retirada",
    })
  );
});

// Fase 1 (callable de asistencia): tenants/{t}/jornadas/{j}/asistencias/{estudianteId}
// Decision 3 de design.md: solo Admin SDK escribe (el callable), el cliente NUNCA
// escribe directo aunque sea instructor autenticado del mismo tenant.
const asistenciaPath = (db, tenantId, jornadaId, estudianteId) => doc(
  db, "tenants", tenantId, "jornadas", jornadaId, "asistencias", estudianteId
);

test("client write to asistencias is always denied, even for an instructor in the same tenant", async () => {
  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertFails(
    setDoc(asistenciaPath(instructorDb, "tenant-1", "jornada-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      horaEntrada: "2026-07-08T15:00:00.000Z",
    })
  );
});

test("instructor can read asistencias in their own tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(asistenciaPath(context.firestore(), "tenant-1", "jornada-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      horaEntrada: "2026-07-08T15:00:00.000Z",
    });
  });

  const instructorDb = client("maestro-1", "tenant-1", "Editor");

  await assertSucceeds(
    getDoc(asistenciaPath(instructorDb, "tenant-1", "jornada-1", "estudiante-1"))
  );
});

test("cross-tenant read of asistencias is denied", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(asistenciaPath(context.firestore(), "tenant-1", "jornada-1", "estudiante-1"), {
      estudianteId: "estudiante-1",
      horaEntrada: "2026-07-08T15:00:00.000Z",
    });
  });

  const otroTenantDb = client("maestro-2", "tenant-2", "Editor");

  await assertFails(
    getDoc(asistenciaPath(otroTenantDb, "tenant-1", "jornada-1", "estudiante-1"))
  );
});
