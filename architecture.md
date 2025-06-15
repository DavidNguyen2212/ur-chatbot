## 🧠 `architecture.md` – System Architecture Documentation

> **Project**: CoolChat – Chatbot Microservice Platform  
> **Author**: David Ng  
> **Last updated**: 2025-06-15

---

## 1. 🔷 Tổng quan kiến trúc

CoolChat là một nền tảng chatbot được xây dựng theo mô hình **Microservice** với các thành phần được container hóa, deploy bằng **Kubernetes**, sử dụng **Traefik** làm ingress gateway và **Kafka** để giao tiếp bất đồng bộ.

```mermaid
graph TD
    subgraph Clients
        Web[Web Client (React)] --> G[API Gateway]
        Mobile[Mobile App] --> G
    end

    subgraph Gateway
        G[FastAPI Gateway] --> TRAEFIK
        TRAEFIK --> AUTH
        TRAEFIK --> CHATBOT
        TRAEFIK --> PAYMENT
    end

    AUTH[(Auth Service - Django)] --> DBAuth[(PostgreSQL)]
    CHATBOT[(Chatbot Service - FastAPI)] --> RAG
    CHATBOT --> Embeddings[LLM & Vector DB (Pinecone)]
    PAYMENT[(Payment Service - Go)] --> KafkaTopic
    KafkaTopic --> NOTIF[(Notification Service)]
    NOTIF --> RedisNotif[(Redis)]
    
    ALLSERVICES[(All services)] --> Jaeger[(Tracing)]
    ALLSERVICES --> Prometheus
    ALLSERVICES --> Grafana
```

---

## 2. 🧱 Thành phần hệ thống

| Service        | Stack                 | Mô tả chức năng |
|----------------|------------------------|-----------------|
| **auth**       | Django, DRF, PostgreSQL | Đăng ký, đăng nhập, quản lý token, OAuth2 |
| **chatbot**    | FastAPI, LangChain, Pinecone | Trả lời câu hỏi người dùng, kết nối LLM và RAG |
| **payment**    | Golang, Kafka           | Xử lý thanh toán, hóa đơn, pub event đến Kafka |
| **gateway**    | FastAPI (optional)      | Định tuyến API, xác thực JWT, proxy logic |
| **notifications** | FastAPI + Redis        | Gửi email, thông báo, xử lý message từ Kafka |
| **traefik**    | Traefik Ingress Proxy   | HTTPS, TLS, load balancing, route traffic |
| **observability** | Prometheus, Grafana, Jaeger | Metrics, logs, tracing toàn hệ thống |

---

## 3. 📃 Cơ sở dữ liệu & message queue

- **PostgreSQL**: Quản lý người dùng (auth).
- **Kafka**: Event-driven (payment → notification, logs).
- **Redis**: Lưu refresh token, verification codes, job queue.
- **Pinecone / FAISS**: Vector search cho RAG.
- **MongoDB (optional)**: Nếu chatbot cần lưu session/ngữ cảnh.

---

## 4. ⚙️ Infrastructure

| Công cụ         | Vai trò |
|------------------|--------|
| **Docker Compose** | Dev local |
| **Kubernetes (k8s)** | Triển khai production |
| **Helm**         | Quản lý release, tái sử dụng manifest |
| **Traefik**      | Ingress controller cho toàn hệ thống |
| **Terraform (optional)** | Provision hạ tầng (OCI, AWS...) |

---

## 5. 🔐 Bảo mật

- **JWT + Refresh Token** cho xác thực
- Mỗi microservice đều validate token nội bộ
- TLS từ Traefik (Let's Encrypt hoặc tự cấp cert)
- CORS & Rate-limit tại API Gateway

---

## 6. ↻ Giao tiếp giữa các service

- **REST**: Hầu hết service dùng HTTP API qua Traefik
- **Kafka**: Cho các event như `user_paid`, `notify_user`, `log_event`
- **Redis pub/sub (optional)**: Nếu cần lightweight queue

---

## 7. 📈 Observability

- **Prometheus**: Thu thập metrics từ service
- **Grafana**: Dashboard theo dõi hiệu suất
- **Jaeger**: Distributed tracing (qua OpenTelemetry)

---

## 8. 🚀 CI/CD pipeline

```
GitHub Actions:
  - build Docker image cho từng service
  - push image lên Docker Hub / GHCR
  - deploy Helm chart lên k8s dev / prod

Optional:
  - Use ArgoCD hoặc FluxCD để auto deploy khi có image mới
```

---

## 9. 🧪 Testing

- `tests/` có các bài kiểm thử e2e, integration
- Sử dụng `pytest`, `pytest-django`, `httpx`, `tox`
- Tự động chạy kiểm thử trong CI pipeline

---

## 10. 📂 Cấu trúc thư mục chính (rút gọn)

```bash
chatbot-platform/
├── apps/              # Mỗi service riêng biệt
├── build/             # Dockerfile cho từng service
├── deploy/            # Helm & K8s manifests
├── libs/              # Code chia sẻ
├── scripts/           # Script tiện ích
├── configs/           # Cấu hình infra: traefik, kafka, prometheus...
├── docker-compose.yml
├── Makefile
└── architecture.md    # << YOU ARE HERE
```

---

## 📌 Ghi chú

- Mô hình này dễ mở rộng sang **event sourcing**, **CQRS**, hoặc **gRPC** nếu dự án lớn dần.
- Dễ chuyển lên production cloud: Oracle Cloud Free, Vultr, hoặc AWS nếu có student credits.

