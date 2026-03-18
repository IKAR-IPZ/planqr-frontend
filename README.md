<div align="center">
  <img src="src/assets/ZUT_Logo.png" alt="PlanQR Logo" width="120" />
  <h1>PlanQR Frontend</h1>
  <p>
    <b>Nowoczesny system obsługi planów zajęć i sal dla Zachodniopomorskiego Uniwersytetu Technologicznego.</b>
  </p>
  
  <p>
    <a href="https://react.dev/">
      <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    </a>
    <a href="https://vitejs.dev/">
      <img src="https://img.shields.io/badge/Vite-5.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    </a>
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License" />
  </p>
</div>

---

## 📖 O Projekcie

**PlanQR Frontend** to interfejs użytkownika stworzony, aby ułatwić studentom i wykładowcom dostęp do aktualnych planów zajęć. System integruje się z infrastrukturą uczelni, umożliwiając podgląd zajęć w czasie rzeczywistym, zarządzanie salami oraz komunikację na linii Wykładowca-Student.

### ✨ Główne Funkcjonalności

- 📅 **Interaktywny Kalendarz**: Przejrzysty widok planu zajęć (oparty na FullCalendar).
- 🔍 **Wyszukiwarka Planów**: Szybki dostęp do planów wykładowców, sal i grup dziekańskich.
- 📱 **Obsługa Tabletów**: Dedykowany tryb wyświetlania dla urządzeń montowanych przy wejściach do sal (tzw. E-Ink/Tablety).
- 💬 **System Wiadomości**: Możliwość zostawiania notatek dla studentów (np. "Zajęcia odwołane").
- 🔒 **Panel Administratora**: Zarządzanie dostępnymi salami i urządzeniami.

## 🛠️ Stack Technologiczny

- **Core**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **UI Components**: [Semantic UI React](https://react.semantic-ui.com/), [FullCalendar](https://fullcalendar.io/)
- **HTTP Client**: Native Fetch / Axios
- **Routing**: [React Router DOM](https://reactrouter.com/)

---

## 🚀 Jak zacząć?

### Wymagania wstępne

- [Node.js](https://nodejs.org/) (wersja 18+)
- [npm](https://www.npmjs.com/) lub [yarn](https://yarnpkg.com/)

### Instalacja

1.  **Sklonuj repozytorium**:
    ```bash
    git clone https://github.com/IKAR-IPZ/planqr-frontend.git
    cd planqr-frontend
    ```

2.  **Zainstaluj zależności**:
    ```bash
    npm install
    ```

3.  **Skonfiguruj środowisko**:
    Frontend korzysta z jednego wspólnego pliku `.env` w katalogu głównym projektu.
    ```bash
    cd ..
    cp .env.dev.example .env
    ```
    Przy lokalnym `npm run dev` frontend automatycznie czyta zmienne z katalogu nadrzędnego.

4.  **Generowanie Certyfikatów (SSL)**:
    Do poprawnego działania aplikacji wymagane są certyfikaty SSL. Wygeneruj je prosto używając narzędzia `mkcert`.

    W głównym katalogu projektu wykonaj:
    ```bash
    # 1. Zainstaluj mkcert (jeśli nie masz) i lokalne CA
    mkcert -install

    # 2. Utwórz katalog i wygeneruj certyfikaty
    mkdir -p certs
    mkcert -key-file certs/cert.key -cert-file certs/cert.pem localhost 127.0.0.1 ::1

    # 3. Konwersja do .pfx (dla backendu) - przy pytaniu o hasło wciśnij Enter (puste)
    openssl pkcs12 -export -out certs/cert.pfx -inkey certs/cert.key -in certs/cert.pem
    ```

5.  **Uruchom aplikację**:
    ```bash
    npm run dev
    ```
    Frontend będzie dostępny pod adresem ustawionym w `FRONTEND_PUBLIC_URL`.

### Uruchomienie z Docker (Produkcja/Full Stack)

Aplikacja jest skonfigurowana do działania w kontenerze.

1.  **Wymagania**: Docker, Docker Compose, mkcert.
2.  **Certyfikaty SSL**:
    Wygeneruj certyfikaty w głównym katalogu projektu:
    ```bash
    mkdir -p certs
    mkcert -key-file certs/cert.key -cert-file certs/cert.pem localhost 127.0.0.1 ::1
    ```
3.  **Uruchomienie**:
    W głównym katalogu projektu (jeden poziom wyżej):
    ```bash
    cp .env.prod.example .env
    docker compose up -d --build
    ```

    Frontend będzie dostępny pod adresem ustawionym w `FRONTEND_PUBLIC_URL`.
    Backend API będzie wystawiony pod adresem z `BACKEND_PUBLIC_URL`.

### Najważniejsze zmienne frontendu

```properties
FRONTEND_PORT=443
FRONTEND_DEV_PORT=3000
FRONTEND_PUBLIC_URL=https://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:9099
BACKEND_INTERNAL_URL=http://backend:9099
ZUT_SCHEDULE_STUDENT_URL=https://plan.zut.edu.pl/schedule_student.php
ZUT_SCHEDULE_URL=https://plan.zut.edu.pl/schedule.php
ZUT_PLAN_BASE_URL=https://plan.zut.edu.pl
```

---

## 🗺️ Nawigacja po Projekcie

Aplikacja podzielona jest na kilka kluczowych modułów dostępnych pod różnymi ścieżkami:

| Ścieżka | Opis |
| :--- | :--- |
| `/` | **Logowanie**. Punkt startowy dla wykładowców i administratorów. |
| `/LecturerPlan/:teacher` | **Plan Wykładowcy**. Widok kalendarza dla konkretnego prowadzącego. |
| `/:department/:room` | **Plan Sali**. Publiczny widok zajęć w danej sali (np. `/WI/WI1-100`). |
| `/tablet/:room/:secretUrl` | **Tryb Kioskowy**. Uproszczony interfejs dla tabletów informacyjnych. |
| `/AdminPanel` | **Administracja**. Panel zarządzania (wymaga uprawnień). |

---

## 🔐 Konfiguracja Uprawnień (AdminPanel)

Dostęp do sekcji administracyjnej jest ściśle kontrolowany. Aby nadać uprawnienia nowemu użytkownikowi:

1. Przejdź do pliku konfiguracyjnego:
   `src/app/admin/adminConfig.ts`

2. Dodaj login użytkownika (zgodny z LDAP ZUT) do listy `allowedLogins`:
   ```typescript
   export const allowedLogins = [
     'kowalski',
     'nowak',
     's12345' // Twój login
   ];
   ```

---

<div align="center">
  Developed with by IKAR-IPZ Team
</div>
