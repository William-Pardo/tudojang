const construirClaves = ({ uid, tenantId, period }) => ({
  global: `global/${period}`,
  tenant: `tenant/${tenantId}/${period}`,
  user: `user/${uid}/${period}`,
});

const crearAlmacenCuotasMemoria = (initial = {}) => {
  const counters = new Map(Object.entries(initial));
  let queue = Promise.resolve();

  return {
    transaction(keys, work) {
      const result = queue.then(() => work(counters));
      queue = result.catch(() => undefined);
      return result;
    },
    snapshot() {
      return Object.fromEntries(
        [...counters.entries()].sort(([left], [right]) =>
          left.localeCompare(right)
        )
      );
    },
  };
};

const convertirClaveDocumento = (key) => key.replaceAll("/", "__");

const crearAlmacenCuotasFirestore = (db) => ({
  async transaction(keys, work) {
    return db.runTransaction(async (transaction) => {
      const references = keys.map((key) =>
        db.doc(`asistente_cuotas/${convertirClaveDocumento(key)}`)
      );
      const snapshots = await transaction.getAll(...references);
      const counters = new Map(
        snapshots.map((snapshot, index) => [
          keys[index],
          snapshot.exists ? snapshot.data().usedMicros : 0,
        ])
      );

      const result = await work(counters);

      references.forEach((reference, index) => {
        transaction.set(
          reference,
          {
            key: keys[index],
            usedMicros: counters.get(keys[index]) ?? 0,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      });

      return result;
    });
  },
});

const crearErrorCuota = (scope) =>
  Object.assign(new Error(`Cuota agotada: ${scope}`), {
    code: "QUOTA_EXHAUSTED",
    scope,
  });

const reservarCuota = async (
  store,
  { uid, tenantId, period, estimatedMicros, limits }
) =>
  store.transaction(Object.values(construirClaves({ uid, tenantId, period })), (counters) => {
    const keys = construirClaves({ uid, tenantId, period });
    const usage = Object.fromEntries(
      Object.entries(keys).map(([scope, key]) => [scope, counters.get(key) ?? 0])
    );

    for (const scope of ["user", "tenant", "global"]) {
      if (usage[scope] + estimatedMicros > limits[scope]) {
        throw crearErrorCuota(scope);
      }
    }

    for (const [scope, key] of Object.entries(keys)) {
      counters.set(key, usage[scope] + estimatedMicros);
    }

    return {
      keys,
      estimatedMicros,
      remaining: {
        user: limits.user - usage.user - estimatedMicros,
        tenant: limits.tenant - usage.tenant - estimatedMicros,
        global: limits.global - usage.global - estimatedMicros,
      },
    };
  });

const reconciliarCuota = async (store, reservation, actualMicros) =>
  store.transaction(Object.values(reservation.keys), (counters) => {
    const adjustment = actualMicros - reservation.estimatedMicros;
    for (const key of Object.values(reservation.keys)) {
      counters.set(key, Math.max(0, (counters.get(key) ?? 0) + adjustment));
    }
  });

module.exports = {
  crearAlmacenCuotasMemoria,
  crearAlmacenCuotasFirestore,
  reservarCuota,
  reconciliarCuota,
};
