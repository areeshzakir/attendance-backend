# Pending Tasks

- [ ] Set up and verify the new environment variables for each endpoint:
  - `GOOGLE_SHEET_RANGE_KPIS`
  - `GOOGLE_SHEET_RANGE_BATCH_ATTENDANCE`
  - `GOOGLE_SHEET_RANGE_ABSENTEES`

---

# Backend & Frontend Integration Task List

## 1. Google Sheets API & Service Account Setup
- [x] Enable Google Sheets API in Google Cloud Console
- [x] Create a service account and download the JSON key
- [x] Share your Google Sheet with the service account email (Editor access)

## 2. Backend Project Initialization
- [x] Create a new project directory
- [x] Initialize Node.js project with `npm init -y`
- [x] Install dependencies: `express`, `googleapis`, `dotenv`, `cors`

## 3. Backend Core Development
- [x] Create `server.js` with:
  - [x] Google Sheets authentication using your JSON key (now via env variable)
  - [x] Use environment variables for sensitive paths/IDs
  - [x] Add CORS support
  - [x] Add a root route for health/status
- [x] Add dedicated endpoints for each data type:
  - [x] `/api/kpis`
  - [x] `/api/batch-attendance`
  - [x] `/api/absentees`
- [x] Use separate environment variables for each endpoint's range

## 4. Security & Clean Code
- [x] Add your JSON key file to `.gitignore` to avoid committing secrets
- [x] Remove any secrets from git history
- [x] Use environment variables for all secrets and IDs

## 5. Local Testing
- [x] Start the server: `node server.js`
- [x] Test each endpoint in your browser or with `curl`/Postman
- [x] Confirm you see your sheet data in JSON format

## 6. Deployment
- [x] Choose a deployment platform (Render)
- [x] Push code to GitHub
- [x] Set up environment variables in Render
- [x] Deploy your backend to Render
- [x] Update the frontend fetch URL to your deployed backend's URL
- [x] Visit your deployed backend's endpoints to confirm they work

## 7. Frontend Integration
- [x] In your Bolt frontend, use the correct fetch URLs for each endpoint
- [x] Display the data in your dashboard as needed
- [x] Confirm the frontend displays live data from your Google Sheet

## 8. (Optional) Enhancements
- [ ] Add more API endpoints (e.g., for updating or deleting sheet data)
- [ ] Add error handling and logging
- [ ] Write unit/integration tests for your backend

---

**Notes:**
- All core backend and integration steps are complete except for setting up the new environment variables for the new endpoints.
- Optional enhancements remain for future improvements.

---

**Is this exhaustive?**
- This list covers all the essential steps for building a backend that connects to Google Sheets, exposes an API, connects to your frontend, and is ready for deployment.
- Optional enhancements are included for production-readiness and future growth.
- If you have custom business logic or additional features, you may need to add tasks specific to those requirements. 