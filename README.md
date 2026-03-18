# PlanQR Frontend

Frontend projektu PlanQR oparty na `React`, `TypeScript` i `Vite`.

Aplikacja:
- lokalnie działa przez serwer developerski Vite
- w Dockerze działa za `nginx` na HTTPS
- korzysta ze wspólnego pliku `../.env`
- proxyuje `/api` do backendu
- proxyuje `schedule.php` i `schedule_student.php`
- odczytuje `ZUT_PLAN_BASE_URL` z runtime config w kontenerze

## Gdzie frontend bierze konfigurację

Frontend korzysta z plików położonych poziom wyżej niż `planqr-frontend`:
- `../.env`
- `../.env.dev.example`
- `../.env.prod.example`
- `../.env.example`
- `../certs/cert.pem`
- `../certs/cert.key`

Najprostszy wybór:
- lokalnie: `cp .env.dev.example .env`
- na serwerze / w środowisku produkcyjnym: `cp .env.prod.example .env`

## Wymagania

- Node.js 20.x i npm 10+, jeśli uruchamiasz frontend bez Dockera
- Docker i Docker Compose v2, jeśli uruchamiasz frontend w kontenerze
- działający backend PlanQR
- dla trybu Docker: certyfikaty `cert.pem` i `cert.key`
- dla pełnego działania aplikacji: działający backend z poprawną bazą danych

## Zmienne `env`

Najważniejsze zmienne frontendu:

| Zmienna | Gdzie używana | Opis |
| --- | --- | --- |
| `FRONTEND_DEV_PORT` | Vite | port lokalnego dev serwera |
| `FRONTEND_PUBLIC_URL` | Vite | publiczny adres używany przez przeglądarkę i HMR |
| `FRONTEND_PORT` | Docker Compose | port hosta mapowany na `nginx:443` |
| `BACKEND_PUBLIC_URL` | Vite | adres backendu widoczny z hosta w trybie developerskim |
| `BACKEND_INTERNAL_URL` | Docker + nginx | adres backendu widoczny z kontenera frontendu |
| `ZUT_SCHEDULE_STUDENT_URL` | Vite + nginx | źródłowy endpoint `schedule_student.php` |
| `ZUT_SCHEDULE_URL` | Vite + nginx | źródłowy endpoint `schedule.php` |
| `ZUT_PLAN_BASE_URL` | build + runtime | bazowy adres używany do linków i kodów QR |

Minimalny blok frontendu w `.env`:

```dotenv
FRONTEND_DEV_PORT=3000
FRONTEND_PUBLIC_URL=https://localhost:3000
FRONTEND_PORT=443
BACKEND_PUBLIC_URL=http://localhost:9099
BACKEND_INTERNAL_URL=http://backend:9099
ZUT_SCHEDULE_STUDENT_URL=https://plan.zut.edu.pl/schedule_student.php
ZUT_SCHEDULE_URL=https://plan.zut.edu.pl/schedule.php
ZUT_PLAN_BASE_URL=https://plan.zut.edu.pl
```

Ważna różnica:
- `BACKEND_PUBLIC_URL` jest używany lokalnie przez Vite
- `BACKEND_INTERNAL_URL` jest używany w Dockerze przez `nginx`

## Uruchomienie lokalne przez `npm`

To jest najlepsza opcja do developmentu frontendu.

### 1. Przygotuj `.env`

W katalogu głównym repo:

```bash
cp .env.dev.example .env
```

Dla typowego developmentu ustaw:

```dotenv
FRONTEND_DEV_PORT=3000
FRONTEND_PUBLIC_URL=https://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:9099
ZUT_SCHEDULE_STUDENT_URL=https://plan.zut.edu.pl/schedule_student.php
ZUT_SCHEDULE_URL=https://plan.zut.edu.pl/schedule.php
ZUT_PLAN_BASE_URL=https://plan.zut.edu.pl
```

### 2. Upewnij się, że backend działa

Lokalny frontend korzysta z proxy do `BACKEND_PUBLIC_URL`, więc backend musi już odpowiadać.

Najczęściej backend uruchomisz tak:

```bash
cd planqr-backend
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

### 3. Przygotuj certyfikaty albo przełącz frontend na HTTP

Jeżeli chcesz działać pod `https://localhost:3000`, przygotuj:
- `certs/cert.pem`
- `certs/cert.key`

Przykład:

```bash
mkdir -p certs
mkcert -install
mkcert -key-file certs/cert.key -cert-file certs/cert.pem localhost 127.0.0.1 ::1
```

Jeżeli nie chcesz lokalnego HTTPS, ustaw:

```dotenv
FRONTEND_PUBLIC_URL=http://localhost:3000
```

Vite sam sprawdzi, czy certyfikaty istnieją:
- jeśli istnieją, wystartuje z HTTPS
- jeśli nie istnieją, wystartuje z HTTP

`FRONTEND_PUBLIC_URL` musi odpowiadać temu, jak frontend naprawdę startuje, bo ta wartość jest używana także przez HMR.

### 4. Zainstaluj zależności i uruchom frontend

```bash
cd planqr-frontend
npm install
npm run dev
```

Po starcie frontend będzie dostępny pod adresem z `FRONTEND_PUBLIC_URL`.

## Jak działa proxy w development

Lokalny Vite proxyuje:
- `/api` do `BACKEND_PUBLIC_URL`
- `/schedule_student.php` do `ZUT_SCHEDULE_STUDENT_URL`
- `/schedule.php` do `ZUT_SCHEDULE_URL`

Dzięki temu kod frontendu może używać ścieżek względnych i nie trzeba przepisywać endpointów w komponentach.

## Uruchomienie tylko frontendu przez `docker compose`

W katalogu `planqr-frontend` znajduje się osobny `docker-compose.yml`.

Ten tryb:
- buduje tylko frontend
- uruchamia `nginx` na HTTPS
- czyta konfigurację z `../.env`
- montuje certyfikaty z `../certs`
- wymaga backendu osiągalnego z kontenera

### 1. Przygotuj `.env`

W katalogu głównym repo:

```bash
cp .env.dev.example .env
```

Najważniejsze wartości:

```dotenv
FRONTEND_PORT=443
BACKEND_INTERNAL_URL=http://host.docker.internal:9099
ZUT_SCHEDULE_STUDENT_URL=https://plan.zut.edu.pl/schedule_student.php
ZUT_SCHEDULE_URL=https://plan.zut.edu.pl/schedule.php
ZUT_PLAN_BASE_URL=https://plan.zut.edu.pl
```

Uwaga:
- `http://backend:9099` działa tylko wtedy, gdy uruchamiasz rootowy `docker compose`, w którym istnieje usługa `backend`
- przy uruchamianiu samego frontendu `BACKEND_INTERNAL_URL` musi wskazywać adres widoczny z kontenera
- `host.docker.internal` zwykle działa na Docker Desktop; na Linuksie użyj adresu osiągalnego z kontenera w Twoim środowisku

### 2. Przygotuj certyfikaty

Kontener frontendu zawsze wymaga:
- `certs/cert.pem`
- `certs/cert.key`

Przykład:

```bash
mkdir -p certs
mkcert -install
mkcert -key-file certs/cert.key -cert-file certs/cert.pem localhost 127.0.0.1 ::1
```

### 3. Uruchom kontener

```bash
cd planqr-frontend
docker compose up --build
```

Po starcie frontend będzie dostępny pod:
- `https://localhost`, jeśli `FRONTEND_PORT=443`
- `https://localhost:<FRONTEND_PORT>`, jeśli używasz innego portu

## Uruchomienie całego stacku przez rootowy `docker compose`

To jest najlepsza opcja, jeśli chcesz postawić frontend i backend razem w sposób zbliżony do docelowego.

Rootowy plik `docker-compose.yml`:
- buduje backend
- buduje frontend
- wymaga wspólnego `.env`
- nie uruchamia PostgreSQL

### 1. Przygotuj `.env`

Lokalnie:

```bash
cp .env.dev.example .env
```

Na środowisko produkcyjne:

```bash
cp .env.prod.example .env
```

Sprawdź szczególnie:

```dotenv
NODE_ENV=development
PORT=9099
BACKEND_HOST_PORT=9099
DISABLE_HTTPS=true
BACKEND_PUBLIC_URL=http://localhost:9099
CORS_ORIGIN=https://localhost
FRONTEND_PORT=443
BACKEND_INTERNAL_URL=http://backend:9099
ZUT_SCHEDULE_STUDENT_URL=https://plan.zut.edu.pl/schedule_student.php
ZUT_SCHEDULE_URL=https://plan.zut.edu.pl/schedule.php
ZUT_PLAN_BASE_URL=https://plan.zut.edu.pl
DATABASE_URL=postgresql://postgres:postgres@db-host:5432/planqr_db?schema=public
JWT_SECRET=change-me
LDAP_URL=ldap://ldap.zut.edu.pl
LDAP_DN=uid=%s,cn=users,cn=accounts,dc=zut,dc=edu,dc=pl
```

Ważne:
- `BACKEND_INTERNAL_URL=http://backend:9099` zostaw bez zmian przy pełnym stacku
- `DATABASE_URL` musi wskazywać bazę widoczną z kontenera backendu
- `CORS_ORIGIN` musi odpowiadać adresowi frontendu widocznemu w przeglądarce
- jeżeli frontend działa na `https://localhost:8443`, ustaw backendowi `CORS_ORIGIN=https://localhost:8443`
- jeżeli zmienisz `BACKEND_HOST_PORT`, ustaw też zgodny `BACKEND_PUBLIC_URL`, na przykład `http://localhost:9191`
- zalecana konfiguracja to `DISABLE_HTTPS=true`, bo TLS kończy się na `nginx` frontendu

### 2. Przygotuj certyfikaty

Frontend w kontenerze nie wystartuje bez:
- `certs/cert.pem`
- `certs/cert.key`

Przykład:

```bash
mkdir -p certs
mkcert -install
mkcert -key-file certs/cert.key -cert-file certs/cert.pem localhost 127.0.0.1 ::1
```

### 3. Uruchom całość

W katalogu głównym repo:

```bash
docker compose up --build
```

Po starcie:
- frontend będzie dostępny pod `https://localhost` albo `https://localhost:<FRONTEND_PORT>`
- `/api` będzie proxowane do backendu
- backend będzie dostępny także bezpośrednio pod `http://localhost:<BACKEND_HOST_PORT>`

## Runtime config w kontenerze

W obrazie `nginx` plik startowy generuje `config.js` z wartości `ZUT_PLAN_BASE_URL`.

To oznacza, że:
- `ZUT_PLAN_BASE_URL` możesz zmienić bez przebudowy frontendu
- po zmianie wystarczy zrestartować kontener frontendu
- pozostałe adresy proxy są brane z konfiguracji `nginx`

## Przydatne komendy

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Najczęstsze problemy

### Frontend nie startuje lokalnie po HTTPS

Brakuje `../certs/cert.pem` albo `../certs/cert.key`, a `FRONTEND_PUBLIC_URL` wskazuje na `https://...`.

### `502 Bad Gateway` pod `/api`

`BACKEND_INTERNAL_URL` wskazuje backend, który nie działa albo nie jest osiągalny z kontenera.

### Pętla reloadów albo HMR nie łączy się poprawnie

`FRONTEND_PUBLIC_URL` nie zgadza się z faktycznym adresem i protokołem, pod którym działa Vite.

### Dane planu sal albo studentów się nie ładują

Sprawdź:
- `ZUT_SCHEDULE_STUDENT_URL`
- `ZUT_SCHEDULE_URL`

### Frontend działa, ale logowanie / API nie działa

Najczęściej problem jest po stronie backendu:
- zła wartość `CORS_ORIGIN`
- niedostępna baza danych
- błędny `BACKEND_PUBLIC_URL`
- brak połączenia z LDAP
