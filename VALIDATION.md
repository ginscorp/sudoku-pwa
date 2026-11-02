# Validation / Проверки — public 0.1.0

Validated on 2026-11-02 / Проверено 02.11.2026.

- Node.js 26.13.0: `node --test tests/*.test.mjs` — **39 passed, 0 failed**. The independent solver checks all **2,200** catalog puzzles for a unique solution. / **39 пройдено, ошибок 0**; независимый решатель проверяет единственность всех **2200** задач.
- Python 3.15.2 on macOS (Apple Silicon): the documented static-only loopback server starts and serves this exact standalone package. / Документированный сервер просмотра запускает именно самостоятельный комплект.
- Chrome 156.0.8078.74 with mobile emulation and an isolated test profile: **16 browser checks passed**. / Chrome с мобильной эмуляцией и отдельным тестовым профилем: **16 проверок пройдено**.

Browser scenarios / Браузерные сценарии: 81-cell board; no horizontal overflow; keyboard input; undo/redo; local-data dialog; local history; move replay; all 39 lessons; diagram stages and quiz; saved-state reload; reload with browser networking disabled; playing offline; another offline reload; zero uncaught errors; zero outside-origin or account/API requests observed.

Границы / Limits: physical iPhone/home-screen installation, Safari/WebKit, Windows, Linux and other browser versions were not tested for this public package. Mobile emulation is not a real-device test. Minimum Python/Node requirements are documented targets; only the versions listed above were used here. No account, cloud synchronization or deployment tests apply to this local-only edition. / Физический iPhone, установка на домашний экран, Safari/WebKit, Windows, Linux и другие версии браузеров этим публичным комплектом не проверялись. Эмуляция не заменяет устройство; минимальные версии — требования, фактические среды перечислены выше. Аккаунты, облачная синхронизация и развертывание в эту локальную версию не входят.
