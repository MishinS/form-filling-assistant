import path from "node:path";

/** Путь к разметке «Паспорта Заказа и договора». Только серверный модуль:
 *  тянет `node:path` и читает файл из репозитория. */
export const ED_SKELETON_PATH = path.join(process.cwd(), "lib/render/templates/ed.html");
