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
      const res = await query('SELECT id, session_id FROM whatsapp_session WHERE session_id = $1', [session]);
      const exists = res.rowCount > 0;
      console.log(`🔍 [PGStore] ¿Sesión "${session}" existe en Neon?: ${exists ? 'SÍ' : 'NO'}`);
      return exists;
    } catch (err) {
      console.error('❌ [PGStore Error - sessionExists]:', err.message);
      return false;
    }
  }

  /**
   * Guarda el archivo de sesión en Neon PostgreSQL (almacenado como TEXT en Base64)
   */
  async save({ session }) {
    try {
      const zipPath = path.join(this.dataPath, `${session}.zip`);
      let dataToSave = '';
      let isZip = false;

      if (fs.existsSync(zipPath)) {
        const fileBuffer = await fs.promises.readFile(zipPath);
        dataToSave = fileBuffer.toString('base64');
        isZip = true;
      } else {
        // Registro inicial o preventivo de tokens
        dataToSave = JSON.stringify({
          session,
          status: 'authenticated',
          timestamp: new Date().toISOString()
        });
      }

      await query(
        'INSERT INTO whatsapp_session (session_id, data) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET data = $2, updated_at = NOW()',
        [session, dataToSave]
      );

      const sizeInfo = isZip ? `(${((dataToSave.length * 0.75) / 1024).toFixed(1)} KB)` : '(token de autenticación)';
      console.log(`💾 [PGStore] Sesión "${session}" guardada exitosamente en Neon PostgreSQL ${sizeInfo}`);
    } catch (err) {
      console.error('❌ [PGStore Error - save]:', err.message);
    }
  }

  /**
   * Extrae la sesión desde Neon PostgreSQL y la restaura en disco
   */
  async extract({ session, path: outPath }) {
    try {
      const res = await query('SELECT data FROM whatsapp_session WHERE session_id = $1', [session]);
      if (res.rowCount > 0 && res.rows[0].data) {
        const raw = res.rows[0].data;
        await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

        let fileBuffer;
        if (Buffer.isBuffer(raw)) {
          fileBuffer = raw;
        } else if (typeof raw === 'string') {
          try {
            fileBuffer = Buffer.from(raw, 'base64');
          } catch {
            fileBuffer = Buffer.from(raw, 'utf-8');
          }
        }

        if (fileBuffer) {
          await fs.promises.writeFile(outPath, fileBuffer);
          console.log(`📥 [PGStore] Sesión "${session}" extraída desde Neon -> ${outPath}`);
        }
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
      await query('DELETE FROM whatsapp_session WHERE session_id = $1', [session]);
      console.log(`🗑️ [PGStore] Sesión "${session}" eliminada de Neon PostgreSQL.`);
    } catch (err) {
      console.error('❌ [PGStore Error - delete]:', err.message);
    }
  }
}

module.exports = PGStore;
