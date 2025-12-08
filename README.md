# PlanQR Frontend

Aplikacja frontendowa dla systemu PlanQR, służąca do wyświetlania planów zajęć, zarządzania salami oraz komunikacji z wykładowcami.

## 🚀 Instalacja i Uruchomienie

1.  **Zainstaluj zależności**:
    ```bash
    npm install
    ```

2.  **Uruchom serwer deweloperski**:
    ```bash
    npm run dev
    ```
    Aplikacja będzie dostępna pod adresem: `http://localhost:5173` (lub `https` jeśli skonfigurowano certyfikaty).

## 🗺️ Struktura i Nawigacja (Podstrony)

Aplikacja korzysta z `react-router-dom`. Oto dostępne ścieżki:

| Ścieżka URL | Opis |
| :--- | :--- |
| `/` | **Strona Główna / Logowanie**. Tutaj użytkownicy mogą się zalogować. |
| `/LecturerPlan/:teacher` | **Plan Wykładowcy**. Wyświetla kalendarz zajęć konkretnego wykładowcy. <br>Przykład: `/LecturerPlan/Kowalski%20Jan` |
| `/:department/:room` | **Plan Sali**. Wyświetla plan zajęć dla konkretnej sali na wydziale. <br>Przykład: `/WI/WI1-100` |
| `/AdminPanel` | **Panel Administratora**. Zarządzanie urządzeniami i salami. Wymaga uprawnień. |
| `/tablet/:department/:room/:secretUrl` | **Widok Tabletu**. Specjalny widok dla urządzeń zamontowanych przy salach (wymaga tajnego URL). |

## 🔑 Uprawnienia Administratora (AdminPanel)

Dostęp do Panelu Administratora (`/AdminPanel`) jest zabezpieczony. Aby nadać sobie lub innemu użytkownikowi uprawnienia:

1.  Otwórz plik: `src/app/admin/adminConfig.ts`
2.  Dodaj login użytkownika (zgodny z loginem ZUT) do tablicy `allowedLogins`.

**Przykład:**
```typescript
// src/app/admin/adminConfig.ts
export const allowedLogins = ['s12345', 'kowalski', 'twoj_login'];
```

> **Uwaga**: Musisz być zalogowany w aplikacji tym samym loginem, który wpisałeś do tablicy.

## ⚙️ Konfiguracja (Environment Variables)

Plik `.env` zawiera kluczowe ustawienia. Upewnij się, że `VITE_SITE_URL` wskazuje na poprawny adres backendu.

```ini
# Przykład dla lokalnego backendu HTTP
VITE_SITE_URL=http://localhost:9099
```

Jeśli backend działa na HTTPS, zmień protokół na `https`.
