/**
 * Almacén de Sesión Remota en PostgreSQL (Neon) para whatsapp-web.js
 * Proyecto: Invitación 15 Años Keyberlis
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../db');

class PGStore {
  constructor(options = {}) {
    this.dataPath = path.resolve(options.dataPath || './.wwebjs_auth/');
  }

  /**
   * Verifica si existe una sesión guardada en Neon
   */
  async sessionExists({ session }) {
    try {
      const res = await query('SELECT id FROM whatsapp_session WHERE id = $1', [session]);
      const exists = res.rowCount > 0;
      console.log(`🔍 [PGStore] ¿Sesión "${session}" existe en Neon?: ${exists ? 'SÍ' : 'NO'}`);
      return exists;
    } catch (err) {
      console.error('❌ [PGStore Error - sessionExists]:', err.message);
      return false;
    }
  }

  /**
   * Guarda el archivo comprimido (.zip) de la sesión en Neon como BYTEA
   */
  async save({ session }) {
    try {
      const zipPath = path.join(this.dataPath, `${session}.zip`);
      if (!fs.existsSync(zipPath)) {
        console.warn(`⚠️ [PGStore Warning] Archivo de sesión no encontrado en: ${zipPath}`);
        return;
      }

      const fileBuffer = await fs.promises.readFile(zipPath);
      await query(`
        INSERT INTO whatsapp_session (id, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP;
      `, [session, fileBuffer]);

      console.log(`💾 [PGStore] Sesión "${session}" guardada en Neon PostgreSQL (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error('❌ [PGStore Error - save]:', err.message);
    }
  }

  /**
   * Extrae la sesión desde Neon PostgreSQL y la escribe como archivo .zip
   */
  async extract({ session, path: outPath }) {
    try {
      const res = await query('SELECT data FROM whatsapp_session WHERE id = $1', [session]);
      if (res.rowCount > 0 && res.rows[0].data) {
        await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
        await fs.promises.writeFile(outPath, res.rows[0].data);
        console.log(`📥 [PGStore] Sesión "${session}" extraída desde Neon (${(res.rows[0].data.length / 1024).toFixed(1)} KB) -> ${outPath}`);
      } else {
        console.log(`ℹ️ [PGStore] No hay datos de sesión previos para "${session}" en Neon.`);
      }
    } catch (err) {
      console.error('❌ [PGStore Error - extract]:', err.message);
    }
  }

  /**
   * Elimina la sesión guardada de Neon al desconectarse o cerrar sesión
   */
  async delete({ session }) {
    try {
      await query('DELETE FROM whatsapp_session WHERE id = $1', [session]);
      console.log(`🗑️ [PGStore] Sesión "${session}" eliminada de Neon PostgreSQL.`);
    } catch (err) {
      console.error('❌ [PGStore Error - delete]:', err.message);
    }
  }
}

module.exports = PGStore;
