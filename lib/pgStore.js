/**
 * Almacén de Sesión Remota en PostgreSQL (Neon) para Baileys / WhatsApp
 * Proyecto: Invitación 15 Años Keyberlis
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../db');

class PGStore {
  constructor(options = {}) {
    this.dataPath = path.resolve(options.dataPath || './.baileys_auth/');
  }

  /**
   * Serializa todos los archivos de una carpeta a un objeto JSON
   */
  async folderToJson(dir) {
    if (!fs.existsSync(dir)) return null;
    const files = await fs.promises.readdir(dir);
    if (files.length === 0) return null;
    const data = {};
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) {
        data[file] = await fs.promises.readFile(filePath, 'utf8');
      }
    }
    return data;
  }

  /**
   * Restaura los archivos desde un objeto JSON a la carpeta de destino
   */
  async jsonToFolder(data, dir) {
    if (!data || typeof data !== 'object') return false;
    await fs.promises.mkdir(dir, { recursive: true });
    for (const [file, content] of Object.entries(data)) {
      await fs.promises.writeFile(path.join(dir, file), content, 'utf8');
    }
    return true;
  }

  /**
   * Verifica si existe una sesión guardada en Neon
   */
  async sessionExists(sessionParam = 'baileys_session') {
    const session = typeof sessionParam === 'object' ? sessionParam.session : sessionParam;
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
   * Respalda una carpeta de credenciales de Baileys en Neon PostgreSQL
   */
  async saveFolder(folderPath = this.dataPath, sessionName = 'baileys_session') {
    try {
      const dataObj = await this.folderToJson(folderPath);
      if (!dataObj || Object.keys(dataObj).length === 0) return false;
      const jsonString = JSON.stringify(dataObj);
      await query(
        'INSERT INTO whatsapp_session (session_id, data) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET data = $2, updated_at = NOW()',
        [sessionName, jsonString]
      );
      console.log(`💾 [PGStore] Sesión "${sessionName}" (${Object.keys(dataObj).length} archivos, ${(jsonString.length / 1024).toFixed(1)} KB) respaldada en Neon.`);
      return true;
    } catch (err) {
      console.error('❌ [PGStore Error - saveFolder]:', err.message);
      return false;
    }
  }

  /**
   * Restaura una carpeta de credenciales de Baileys desde Neon PostgreSQL
   */
  async extractFolder(folderPath = this.dataPath, sessionName = 'baileys_session') {
    try {
      const res = await query('SELECT data FROM whatsapp_session WHERE session_id = $1', [sessionName]);
      if (res.rowCount > 0 && res.rows[0].data) {
        const raw = res.rows[0].data;
        let dataObj;
        try {
          dataObj = JSON.parse(raw);
        } catch {
          dataObj = null;
        }

        if (dataObj && typeof dataObj === 'object') {
          await this.jsonToFolder(dataObj, folderPath);
          console.log(`📥 [PGStore] Sesión "${sessionName}" restaurada desde Neon en ${folderPath}`);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('❌ [PGStore Error - extractFolder]:', err.message);
      return false;
    }
  }

  async save(sessionParam) {
    const session = typeof sessionParam === 'object' ? sessionParam.session : sessionParam;
    return this.saveFolder(this.dataPath, session);
  }

  async extract(sessionParam) {
    const session = typeof sessionParam === 'object' ? sessionParam.session : sessionParam;
    return this.extractFolder(this.dataPath, session);
  }

  async delete(sessionParam = 'baileys_session') {
    const session = typeof sessionParam === 'object' ? sessionParam.session : sessionParam;
    try {
      await query('DELETE FROM whatsapp_session WHERE session_id = $1', [session]);
      console.log(`🗑️ [PGStore] Sesión "${session}" eliminada de Neon PostgreSQL.`);
    } catch (err) {
      console.error('❌ [PGStore Error - delete]:', err.message);
    }
  }
}

module.exports = PGStore;
