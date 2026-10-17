import app from './app.json'
import biomes from './biomes.json'
import canvas from './canvas.json'
import conn from './conn.json'
import dialogs from './dialogs.json'
import error from './error.json'
import panels from './panels.json'
import pools from './pools.json'
import roads from './roads.json'
import root from './root.json'
import shared from './shared.json'
import variant from './variant.json'
import zone from './zone.json'

/**
 * Неймспейс `common` локали `en`: зеркало locales/ru/common — тот же набор
 * доменных файлов и те же верхнеуровневые группы ключей (карта файлов —
 * locales/ru/README.md). Паритет ключей с ru поддерживается переводом
 * «ключ в ключ»; плюральные группы ru (_one/_few/_many) сведены к паре
 * en (_one/_other) по правилам i18next для английского.
 */
export const enCommon = {
  ...app,
  ...biomes,
  ...dialogs,
  ...panels,
  ...canvas,
  ...shared,
  ...zone,
  ...conn,
  ...variant,
  ...root,
  ...roads,
  ...pools,
  ...error,
}
