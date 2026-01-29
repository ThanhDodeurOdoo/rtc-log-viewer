# RTC Log Viewer
[![Tests](https://github.com/ThanhDodeurOdoo/rtc-log-viewer/actions/workflows/tests.yml/badge.svg)](https://github.com/ThanhDodeurOdoo/rtc-log-viewer/actions/workflows/tests.yml)
[![Deployment](https://github.com/ThanhDodeurOdoo/rtc-log-viewer/actions/workflows/pages/pages-build-deployment/badge.svg)](https://thanhdodeurodoo.github.io/rtc-log-viewer/)

Use it at: https://thanhdodeurodoo.github.io/rtc-log-viewer/

Log viewer for Odoo RTC feature

[See RTC knowledge article.](https://www.odoo.com/knowledge/article/28830)

# Roadmap
- Add peer stats in snapshots (candidate types, DTLS/ICE states, data channel state, packets) to diagnose TURN usage and transport health.
- Add SFU transport/producer stats (bitrate, packet loss, RTT) to enable quality scoring and regression detection.
- Log per-track upload/download intent and active state to distinguish muted, stopped, and consumption-disabled media.
- Record explicit device and permission failures (mic/camera/screen) to improve media troubleshooting.
- Add periodic stats sampling with timestamps for trend analysis across a call.
