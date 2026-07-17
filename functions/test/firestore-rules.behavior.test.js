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
  query,
  where,
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

// Regla canonica de roles (CIERRE CENTRO DE ESTUDIOS.md 14.9): desde 2026-07-09
// SI existe un rol 'Maestro' separado en RolUsuario (quien ensena y asigna clases).
// A nivel rules, Maestro entra a isInstructor() con las mismas capacidades operativas
// que Editor (cuya capacidad docente queda como legacy). Tutor = padre/acudiente,
// nunca instructor. Este test espeja el caso Editor de arriba con rol Maestro.
test("instructor (Maestro) can delete an academic assignment in their own tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "asignaciones", "asignacion-maestro"),
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
        creadoPorUid: "maestro-rol-real",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    );
  });

  const maestroDb = client("maestro-rol-real", "tenant-1", "Maestro");

  await assertSucceeds(
    deleteDoc(doc(maestroDb, "tenants", "tenant-1", "asignaciones", "asignacion-maestro"))
  );
});

test("instructor (Maestro) from another tenant cannot delete an academic assignment", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "asignaciones", "asignacion-maestro-2"),
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
        creadoPorUid: "maestro-rol-real",
        creadoEn: "2026-06-27T00:00:00.000Z",
        actualizadoEn: "2026-06-27T00:00:00.000Z",
      }
    );
  });

  const maestroOtroTenantDb = client("maestro-rol-ajeno", "tenant-2", "Maestro");

  await assertFails(
    deleteDoc(doc(maestroOtroTenantDb, "tenants", "tenant-1", "asignaciones", "asignacion-maestro-2"))
  );
});

// =========================================================================
// Jornadas de instrucción — permiso "maestro asignado" (subtarea 12.2)
// El maestro asignado se identifica por resource.data.instructorId == request.auth.uid.
// (Nota 14.9: cuando se escribio esta seccion no existia un rol "Maestro" separado;
// ahora existe y entra por isInstructor(). Editor/Asistente solo pueden editar la
// jornada donde estén asignados; Admin/SuperAdmin pueden editar cualquiera del tenant.)
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

// 12.12 (seccion 22 del documento de mejora, caso "No se puede editar clase de otro
// tenant"): la matriz de permisos de jornadas ya tenia cobertura de maestro asignado/no
// asignado/admin/estudiante, todos dentro del MISMO tenant -- ningun test cruzaba el
// limite de tenant para `jornadas` puntualmente (si existia para `asignaciones`,
// `asistencias` e `inscripciones`, pero no para el documento de jornada en si).
test("instructor from another tenant cannot update a jornada that belongs to a different tenant", async () => {
  await seedJornadaAsignada();

  const otroTenantDb = client("maestro-otro-tenant", "tenant-2", "Editor");

  await assertFails(
    updateDoc(doc(otroTenantDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("admin from another tenant cannot update a jornada that belongs to a different tenant", async () => {
  await seedJornadaAsignada();

  const otroTenantAdminDb = client("admin-otro-tenant", "tenant-2", "Admin");

  await assertFails(
    updateDoc(doc(otroTenantAdminDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

// =========================================================================
// Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la parrilla de
// Agenda, ver CIERRE CENTRO DE ESTUDIOS.md): Estudiante ahora ve Agenda en modo solo
// lectura, y Asistente/Editor pueden editar jornadas ajenas si el Admin les otorgo el flag
// `permisoEdicionAgenda` (nuevo en Usuario, tipos.ts). `client()` solo setea CUSTOM CLAIMS
// (rol/tenantId) -- `permisoEdicionAgenda` se lee del documento REAL `usuarios/{uid}` via
// `currentUser()`, asi que estos tests seedean ese documento explicitamente (a diferencia
// del resto de tests de esta seccion, que no necesitan un documento real porque rol/tenant
// ya vienen resueltos por claims).
// =========================================================================

test("Estudiante can read a jornada in their tenant (Agenda en modo solo lectura)", async () => {
  await seedJornadaAsignada();

  const estudianteDb = client("est-agenda-1", "tenant-1", "Estudiante");

  await assertSucceeds(
    getDoc(doc(estudianteDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("Asistente with permisoEdicionAgenda=true can update a jornada they are not assigned to", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "asistente-con-permiso"), {
      tenantId: "tenant-1",
      email: "asistente-con-permiso@test.com",
      rol: "Asistente",
      permisoEdicionAgenda: true,
    });
  });

  const asistenteDb = client("asistente-con-permiso", "tenant-1", "Asistente");

  await assertSucceeds(
    updateDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("Editor with permisoEdicionAgenda=true can update a jornada they are not assigned to (mismo criterio que Asistente)", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "editor-con-permiso"), {
      tenantId: "tenant-1",
      email: "editor-con-permiso@test.com",
      rol: "Editor",
      permisoEdicionAgenda: true,
    });
  });

  const editorDb = client("editor-con-permiso", "tenant-1", "Editor");

  await assertSucceeds(
    updateDoc(doc(editorDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("Asistente WITHOUT permisoEdicionAgenda (flag=false) still cannot update a jornada they are not assigned to", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "asistente-sin-permiso"), {
      tenantId: "tenant-1",
      email: "asistente-sin-permiso@test.com",
      rol: "Asistente",
      permisoEdicionAgenda: false,
    });
  });

  const asistenteDb = client("asistente-sin-permiso", "tenant-1", "Asistente");

  await assertFails(
    updateDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("Asistente without a usuarios/{uid} document at all still cannot update a jornada they are not assigned to (no revienta el get())", async () => {
  await seedJornadaAsignada();

  // A proposito, sin seedear usuarios/asistente-sin-doc: ejercita la guarda hasCurrentUser()
  // agregada junto con el flag -- sin ella, currentUser().permisoEdicionAgenda revienta la
  // regla entera para cualquier uid sin documento real (p.ej. datos de transicion).
  const asistenteDb = client("asistente-sin-doc", "tenant-1", "Asistente");

  await assertFails(
    updateDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

test("Maestro with permisoEdicionAgenda=true (dato inesperado) still cannot update a jornada from another instructor -- el flag esta acotado a Asistente/Editor", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "maestro-con-flag-inesperado"), {
      tenantId: "tenant-1",
      email: "maestro-con-flag-inesperado@test.com",
      rol: "Maestro",
      permisoEdicionAgenda: true,
    });
  });

  const maestroDb = client("maestro-con-flag-inesperado", "tenant-1", "Maestro");

  await assertFails(
    updateDoc(doc(maestroDb, "tenants", "tenant-1", "jornadas", "jornada-1"), {
      estado: "en_curso",
      actualizadoEn: "2026-07-06T08:05:00.000Z",
    })
  );
});

// =========================================================================
// Ampliacion posterior al cierre inicial de la extension de matriz de roles (decision de
// producto explicita del usuario, ver CIERRE CENTRO DE ESTUDIOS.md): "eliminar" ya NO es
// exclusivo de Admin/SuperAdmin -- replica EXACTO el mismo criterio de tres OR que `update`
// (maestro asignado via instructorId, Asistente/Editor via permisoEdicionAgenda). El test
// "Asistente with permisoEdicionAgenda=true still cannot DELETE a jornada" que vivia aca
// documentaba el comportamiento VIEJO (delete = isAdmin() unicamente) y se reemplaza por
// esta seccion, que cubre la matriz completa igual que la seccion de `update` de arriba.
// =========================================================================

test("Admin can DELETE any jornada in their tenant regardless of instructorId", async () => {
  await seedJornadaAsignada();

  const adminDb = client("user-1", "tenant-1", "Admin");

  await assertSucceeds(
    deleteDoc(doc(adminDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("assigned instructor (Maestro) can DELETE their own jornada", async () => {
  await seedJornadaAsignada();

  const asignadoDb = client("maestro-asignado", "tenant-1", "Maestro");

  await assertSucceeds(
    deleteDoc(doc(asignadoDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("non-assigned instructor (Maestro) cannot DELETE another instructor's jornada", async () => {
  await seedJornadaAsignada();

  const intrusoDb = client("maestro-otro", "tenant-1", "Maestro");

  await assertFails(
    deleteDoc(doc(intrusoDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("Asistente with permisoEdicionAgenda=true CAN now DELETE a jornada they are not assigned to (mismo criterio que update)", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "asistente-con-permiso-delete"), {
      tenantId: "tenant-1",
      email: "asistente-con-permiso-delete@test.com",
      rol: "Asistente",
      permisoEdicionAgenda: true,
    });
  });

  const asistenteDb = client("asistente-con-permiso-delete", "tenant-1", "Asistente");

  await assertSucceeds(
    deleteDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("Editor with permisoEdicionAgenda=true CAN DELETE a jornada they are not assigned to (mismo criterio que Asistente)", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "editor-con-permiso-delete"), {
      tenantId: "tenant-1",
      email: "editor-con-permiso-delete@test.com",
      rol: "Editor",
      permisoEdicionAgenda: true,
    });
  });

  const editorDb = client("editor-con-permiso-delete", "tenant-1", "Editor");

  await assertSucceeds(
    deleteDoc(doc(editorDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("Asistente WITHOUT permisoEdicionAgenda (flag=false) still cannot DELETE a jornada they are not assigned to", async () => {
  await seedJornadaAsignada();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "asistente-sin-permiso-delete"), {
      tenantId: "tenant-1",
      email: "asistente-sin-permiso-delete@test.com",
      rol: "Asistente",
      permisoEdicionAgenda: false,
    });
  });

  const asistenteDb = client("asistente-sin-permiso-delete", "tenant-1", "Asistente");

  await assertFails(
    deleteDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("Asistente without a usuarios/{uid} document at all still cannot DELETE a jornada they are not assigned to (no revienta el get())", async () => {
  await seedJornadaAsignada();

  // A proposito, sin seedear usuarios/asistente-sin-doc-delete: mismo chequeo que en
  // `update` para confirmar que hasCurrentUser() sigue blindando el get() tambien en delete.
  const asistenteDb = client("asistente-sin-doc-delete", "tenant-1", "Asistente");

  await assertFails(
    deleteDoc(doc(asistenteDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
  );
});

test("student cannot DELETE a jornada", async () => {
  await seedJornadaAsignada();

  const estudianteDb = client("est-delete-1", "tenant-1", "Estudiante");

  await assertFails(
    deleteDoc(doc(estudianteDb, "tenants", "tenant-1", "jornadas", "jornada-1"))
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

// Fix tutor-role-end-to-end (2026-07-14): verificación REAL (contra firestore.rules,
// no mocks) de que un Tutor puede leer al estudiante donde figura como acudiente
// (estudiante.tutor.correo == su email de login) y NO puede leer a otros.
test("tutor can read the student where they are the acudiente (tutor.correo == su email)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "estudiantes", "est-hijo"), {
      tenantId: "tenant-1",
      nombres: "Alejandro",
      apellidos: "Tester",
      tutor: { correo: "papa@test.com", nombres: "Papa", apellidos: "Tester" },
    });
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "papa@test.com" });

  // Query como lo hace el resolver real: filtra por tutor.correo == su email.
  await assertSucceeds(
    getDocs(query(collection(tutorDb, "estudiantes"), where("tutor.correo", "==", "papa@test.com")))
  );
});

test("tutor cannot read a student where they are NOT the acudiente", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "estudiantes", "est-ajeno"), {
      tenantId: "tenant-1",
      nombres: "Otro",
      apellidos: "Nino",
      tutor: { correo: "papa@test.com", nombres: "Papa", apellidos: "Tester" },
    });
  });

  // Un tutor con OTRO email no debe poder leer al estudiante de papa@test.com.
  const otroTutorDb = client("tutor-2", "tenant-1", "Tutor", { email: "distinto@test.com" });

  await assertFails(getDoc(doc(otroTutorDb, "estudiantes", "est-ajeno")));

  // Y tampoco puede burlar la regla consultando por el correo ajeno (el query no
  // coincide con su token.email, la regla lo rechaza).
  await assertFails(
    getDocs(query(collection(otroTutorDb, "estudiantes"), where("tutor.correo", "==", "papa@test.com")))
  );
});

// Fix 2026-07-16 (bug reportado: Estudiante no veía material ni clases): a diferencia de
// Tutor (que ya tenía su caso desde el fix 2026-07-14), nunca se agregó el caso análogo
// para que el propio Estudiante lea SU PROPIO doc por `correo == su email` -- la query real
// de resolveStudentsForConsultor(tenantId, email, esTutor=false) siempre fallaba.
test("student can read their own student record (correo == su email)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "estudiantes", "est-propio"), {
      tenantId: "tenant-1",
      nombres: "Ale",
      apellidos: "Estudiante",
      correo: "ale@test.com",
    });
  });

  const estudianteDb = client("est-user-1", "tenant-1", "Estudiante", { email: "ale@test.com" });

  // Query como lo hace el resolver real: filtra por correo == su propio email.
  await assertSucceeds(
    getDocs(query(collection(estudianteDb, "estudiantes"), where("correo", "==", "ale@test.com")))
  );
});

test("student cannot read another student's record", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "estudiantes", "est-ajeno-2"), {
      tenantId: "tenant-1",
      nombres: "Otro",
      apellidos: "Nino",
      correo: "ale@test.com",
    });
  });

  const otroEstudianteDb = client("est-user-2", "tenant-1", "Estudiante", { email: "distinto@test.com" });

  await assertFails(getDoc(doc(otroEstudianteDb, "estudiantes", "est-ajeno-2")));
  await assertFails(
    getDocs(query(collection(otroEstudianteDb, "estudiantes"), where("correo", "==", "ale@test.com")))
  );
});

// Fix tutor-role-end-to-end (2026-07-14): el Tutor puede LEER las jornadas de su tenant
// (Agenda solo lectura; el cliente filtra a las clases del hijo).
test("tutor can read jornadas in their tenant (read-only agenda)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tenants", "tenant-1", "jornadas", "jor-tutor-1"), {
      tenantId: "tenant-1",
      grupoId: "grupo-infantil",
      sedeId: "sede-1",
      horaInicio: "17:00",
      horaFin: "18:00",
      estado: "confirmada",
    });
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "papa@test.com" });
  await assertSucceeds(getDoc(doc(tutorDb, "tenants", "tenant-1", "jornadas", "jor-tutor-1")));
});

test("tutor from another tenant cannot read jornadas", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tenants", "tenant-1", "jornadas", "jor-tutor-2"), {
      tenantId: "tenant-1", grupoId: "grupo-infantil", sedeId: "sede-1", estado: "confirmada",
    });
  });
  const otroTutorDb = client("tutor-9", "tenant-2", "Tutor", { email: "otro@test.com" });
  await assertFails(getDoc(doc(otroTutorDb, "tenants", "tenant-1", "jornadas", "jor-tutor-2")));
});

// Fix tutor-role-end-to-end (2026-07-14): buzón de notificaciones scoped por estudiante.
test("tutor can read notifications of their child, estudiante of their own, not others", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Estudiante hijo del tutor papa@test.com
    await setDoc(doc(db, "estudiantes", "est-hijo"), {
      tenantId: "tenant-1", nombres: "Ale", correo: "ale@test.com",
      tutor: { correo: "papa@test.com" },
    });
    // Estudiante ajeno
    await setDoc(doc(db, "estudiantes", "est-ajeno"), {
      tenantId: "tenant-1", nombres: "Otro", correo: "otro-est@test.com",
      tutor: { correo: "otropapa@test.com" },
    });
    await setDoc(doc(db, "historialNotificaciones", "notif-hijo"), {
      estudianteId: "est-hijo", mensaje: "Pago al día", tipo: "RecordatorioPago", leida: false, fecha: "2026-07-14",
    });
    await setDoc(doc(db, "historialNotificaciones", "notif-ajeno"), {
      estudianteId: "est-ajeno", mensaje: "Otra", tipo: "Bienvenida", leida: false, fecha: "2026-07-14",
    });
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "papa@test.com" });
  // Lee la de su hijo (get)
  await assertSucceeds(getDoc(doc(tutorDb, "historialNotificaciones", "notif-hijo")));
  // Query de lista scoped a su hijo
  await assertSucceeds(getDocs(query(collection(tutorDb, "historialNotificaciones"), where("estudianteId", "==", "est-hijo"))));
  // NO la del estudiante ajeno
  await assertFails(getDoc(doc(tutorDb, "historialNotificaciones", "notif-ajeno")));

  // El estudiante lee la suya por correo propio
  const estDb = client("est-user-1", "tenant-1", "Estudiante", { email: "ale@test.com" });
  await assertSucceeds(getDoc(doc(estDb, "historialNotificaciones", "notif-hijo")));
});

test("tutor can mark notification as read (only 'leida' field)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "estudiantes", "est-hijo2"), {
      tenantId: "tenant-1", nombres: "Ale2", correo: "ale2@test.com", tutor: { correo: "papa2@test.com" },
    });
    await setDoc(doc(db, "historialNotificaciones", "notif-2"), {
      estudianteId: "est-hijo2", mensaje: "x", tipo: "Bienvenida", leida: false, fecha: "2026-07-14",
    });
  });
  const tutorDb = client("tutor-2", "tenant-1", "Tutor", { email: "papa2@test.com" });
  // Solo cambiar leida -> OK
  await assertSucceeds(updateDoc(doc(tutorDb, "historialNotificaciones", "notif-2"), { leida: true }));
  // Cambiar el mensaje -> rechazado
  await assertFails(updateDoc(doc(tutorDb, "historialNotificaciones", "notif-2"), { mensaje: "hackeado" }));
});

// Banco de preguntas de quiz (fix del gap "no hay forma de editar preguntas reales de un
// quiz" -- QuizView.tsx usaba siempre una pregunta hardcodeada porque no existía ninguna
// colección de contenido pedagógico para quizzes).
test("instructor (Maestro) can create and update the question bank for a quiz resource", async () => {
  const maestroDb = client("maestro-quiz-1", "tenant-1", "Maestro");

  await assertSucceeds(
    setDoc(doc(maestroDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-1"), {
      recursoId: "recurso-quiz-1",
      tenantId: "tenant-1",
      preguntas: [{ id: "p1", enunciado: "¿Qué es un poomsae?", opciones: ["Una forma", "Un arma"], respuestaCorrecta: "Una forma" }],
      actualizadoPorUid: "maestro-quiz-1",
      actualizadoEn: "2026-07-16T00:00:00.000Z",
    })
  );

  await assertSucceeds(
    updateDoc(doc(maestroDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-1"), {
      preguntas: [{ id: "p1", enunciado: "¿Qué es un poomsae? (editado)", opciones: ["Una forma", "Un arma"], respuestaCorrecta: "Una forma" }],
    })
  );
});

test("Estudiante/Tutor can read the question bank but cannot write it", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tenants", "tenant-1", "quizzes", "recurso-quiz-2"), {
      recursoId: "recurso-quiz-2",
      tenantId: "tenant-1",
      preguntas: [{ id: "p1", enunciado: "x", opciones: ["a", "b"], respuestaCorrecta: "a" }],
      actualizadoPorUid: "maestro-1",
      actualizadoEn: "2026-07-16T00:00:00.000Z",
    });
  });

  const estudianteDb = client("est-quiz-1", "tenant-1", "Estudiante");
  await assertSucceeds(getDoc(doc(estudianteDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-2")));
  await assertFails(
    updateDoc(doc(estudianteDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-2"), { preguntas: [] })
  );

  const tutorDb = client("tutor-quiz-1", "tenant-1", "Tutor");
  await assertSucceeds(getDoc(doc(tutorDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-2")));
  await assertFails(
    updateDoc(doc(tutorDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-2"), { preguntas: [] })
  );
});

test("instructor from another tenant cannot write the question bank", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tenants", "tenant-1", "quizzes", "recurso-quiz-3"), {
      recursoId: "recurso-quiz-3",
      tenantId: "tenant-1",
      preguntas: [],
      actualizadoPorUid: "maestro-1",
      actualizadoEn: "2026-07-16T00:00:00.000Z",
    });
  });

  const otroTenantDb = client("maestro-otro-tenant", "tenant-2", "Editor");
  await assertFails(
    updateDoc(doc(otroTenantDb, "tenants", "tenant-1", "quizzes", "recurso-quiz-3"), { preguntas: [] })
  );
});

// =========================================================================
// Visualizaciones de video de YouTube (reemplazo de Drive SOLO para video, decisión
// de producto 2026-07 -- ver firestore.rules y servicios/academico/visualizacionRepository.ts).
// Reusa canReadProgress-like criteria (isInstructor en vez de isAdmin) y
// canWriteOwnStudentProgress, ya cubiertos por los tests de `progreso` de arriba, pero
// nadie había verificado puntualmente el caso cross-tenant ni la matriz de roles staff
// sobre esta colección concreta (path por RECURSO -> alumno, no alumno -> asignación).
// =========================================================================

const visualizacionPath = (db, tenantId, recursoId, uid) => doc(
  db, "tenants", tenantId, "visualizaciones", recursoId, "alumnos", uid
);

const VISUALIZACION_DATA = {
  tenantId: "tenant-1",
  recursoId: "recurso-video-1",
  porcentajeVisto: 40,
  completado: false,
  vecesIniciado: 1,
};

test("student can read their own visualizaciones doc in their tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const estudianteDb = client("est-1", "tenant-1", "Estudiante");

  await assertSucceeds(
    getDoc(visualizacionPath(estudianteDb, "tenant-1", "recurso-video-1", "est-1"))
  );
});

test("student cannot read another student's visualizaciones doc in the same tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-ajeno"),
      { ...VISUALIZACION_DATA, tenantId: "tenant-1" }
    );
  });

  const estudianteDb = client("est-1", "tenant-1", "Estudiante");

  await assertFails(
    getDoc(visualizacionPath(estudianteDb, "tenant-1", "recurso-video-1", "est-ajeno"))
  );
});

// Caso mas importante para el dueño del producto: un alumno de OTRO tenant no puede
// leer, aunque el recurso/uid coincidan.
test("student from another tenant cannot read a visualizaciones doc (cross-tenant read denied)", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const otroTenantDb = client("est-2", "tenant-2", "Estudiante");

  await assertFails(
    getDoc(visualizacionPath(otroTenantDb, "tenant-1", "recurso-video-1", "est-1"))
  );
});

// isInstructor() cubre Admin/Editor/Asistente/Maestro/SuperAdmin -- necesario para que
// el reporte de staff (Paso 7) pueda leer el progreso de cualquier alumno de su tenant.
test("staff roles (Admin, Editor, Asistente, Maestro) can read any student's visualizaciones doc in their own tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  for (const rol of ["Admin", "Editor", "Asistente", "Maestro"]) {
    const staffDb = client(`staff-${rol}`, "tenant-1", rol);
    await assertSucceeds(
      getDoc(visualizacionPath(staffDb, "tenant-1", "recurso-video-1", "est-1"))
    );
  }
});

test("instructor from another tenant cannot read a visualizaciones doc", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const otroTenantDb = client("maestro-otro-tenant", "tenant-2", "Maestro");

  await assertFails(
    getDoc(visualizacionPath(otroTenantDb, "tenant-1", "recurso-video-1", "est-1"))
  );
});

test("linked tutor can read their child's visualizaciones doc", async () => {
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
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "tutor@test.com" });

  const snapshot = await assertSucceeds(
    getDoc(visualizacionPath(tutorDb, "tenant-1", "recurso-video-1", "est-1"))
  );
  assert.equal(snapshot.data().porcentajeVisto, 40);
});

test("unlinked tutor cannot read a student's visualizaciones doc", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const tutorDb = client("tutor-2", "tenant-1", "Tutor", { email: "otro@test.com" });

  await assertFails(
    getDoc(visualizacionPath(tutorDb, "tenant-1", "recurso-video-1", "est-1"))
  );
});

test("student can write their own visualizaciones doc", async () => {
  const estudianteDb = client("est-1", "tenant-1", "Estudiante");

  await assertSucceeds(
    setDoc(
      visualizacionPath(estudianteDb, "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    )
  );
});

test("student cannot write another student's visualizaciones doc (same tenant or another tenant)", async () => {
  const estudianteDb = client("est-1", "tenant-1", "Estudiante");

  await assertFails(
    setDoc(
      visualizacionPath(estudianteDb, "tenant-1", "recurso-video-1", "est-ajeno"),
      VISUALIZACION_DATA
    )
  );

  const otroTenantDb = client("est-2", "tenant-2", "Estudiante");

  await assertFails(
    setDoc(
      visualizacionPath(otroTenantDb, "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    )
  );
});

test("tutor cannot write student visualizaciones but can read it in same tenant", async () => {
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
      visualizacionPath(context.firestore(), "tenant-1", "recurso-video-1", "est-1"),
      VISUALIZACION_DATA
    );
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "tutor@test.com" });

  await assertSucceeds(
    getDoc(visualizacionPath(tutorDb, "tenant-1", "recurso-video-1", "est-1"))
  );

  await assertFails(
    setDoc(
      visualizacionPath(tutorDb, "tenant-1", "recurso-video-1", "est-1"),
      { ...VISUALIZACION_DATA, porcentajeVisto: 99, completado: true, vecesIniciado: 2 }
    )
  );
});
