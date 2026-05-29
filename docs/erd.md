# Modelo de Dados (ERD) — CV-Adapter

Diagrama de entidade-relacionamento da base de dados. Toda entidade de domínio carrega
`userId` (FK para `User`) — garantia de migração para multiusuário sem retrabalho.
Versão Mermaid pura para o plugin do VS Code: `docs/erd.mmd`.

```mermaid
erDiagram
    User ||--|| Profile : "tem (1:1 no MVP)"
    User ||--o{ Experience : "possui"
    User ||--o{ Education : "possui"
    User ||--o{ Skill : "possui"
    User ||--o{ Project : "possui"
    User ||--o{ Language : "possui"
    User ||--o{ Course : "possui"
    User ||--o{ JobPosting : "cola"
    User ||--o{ GeneratedResume : "gera"
    Profile ||--o{ Experience : "agrupa"
    Profile ||--o{ Education : "agrupa"
    Profile ||--o{ Skill : "agrupa"
    Profile ||--o{ Project : "agrupa"
    Profile ||--o{ Language : "agrupa"
    Profile ||--o{ Course : "agrupa"
    JobPosting ||--o{ GeneratedResume : "origina (Modo 2)"

    User {
        string id PK
        string email "opcional no MVP"
        datetime createdAt
    }

    Profile {
        string id PK
        string userId FK
        string fullName
        string phone
        string location
        string email
        string linkedin "opcional"
        string github "opcional"
        string website "opcional"
        string summary "resumo/objetivo"
        datetime updatedAt
    }

    Experience {
        string id PK
        string userId FK
        string profileId FK
        string company
        string role
        string location "opcional"
        string startDate
        string endDate "opcional"
        boolean current
        json bullets "string[]"
        int order
    }

    Education {
        string id PK
        string userId FK
        string profileId FK
        string institution
        string degree
        string field "opcional"
        string startDate
        string endDate "opcional"
        string gpa "opcional"
        string details "opcional"
        int order
    }

    Skill {
        string id PK
        string userId FK
        string profileId FK
        string category "ex: Tecnicas, Soft skills"
        string name
        string level "opcional"
        int order
    }

    Project {
        string id PK
        string userId FK
        string profileId FK
        string name
        string description
        json bullets "string[]"
        json techStack "string[]"
        string url "opcional"
        int order
    }

    Language {
        string id PK
        string userId FK
        string profileId FK
        string name
        string proficiency
        int order
    }

    Course {
        string id PK
        string userId FK
        string profileId FK
        string title
        string issuer
        string date
        string url "opcional"
        int order
    }

    JobPosting {
        string id PK
        string userId FK
        string rawText
        string title "opcional"
        string company "opcional"
        json parsedKeywords "opcional"
        datetime createdAt
    }

    GeneratedResume {
        string id PK
        string userId FK
        string mode "STANDARD | JOB_ADAPTIVE"
        string jobPostingId FK "opcional (Modo 2)"
        string modelId
        json contentJson "ResumeContent validado"
        string texOutput "o .tex renderizado (cache)"
        json traceabilityReport "opcional"
        datetime createdAt
    }
```

## Notas de modelagem

- **`userId` em tudo:** no MVP há um único `User` semeado (`LOCAL_USER_ID`); migrar para
  multiusuário não muda o schema, só a origem do id (seam `getCurrentUserId()`).
- **Campos JSON** (`bullets`, `techStack`, `parsedKeywords`, `contentJson`,
  `traceabilityReport`): mesmo formato em SQLite e Postgres.
- **`texOutput` cacheado:** rebaixar um currículo do histórico não refaz chamada ao LLM.
- **Datas como string:** currículos usam formatos livres ("Jan 2017", "Atual", "2024");
  validação fica na camada Zod, não no banco.
