import { createBrowserRouter, RouteObject } from "react-router-dom";
import App from "../../App";
import LecturerPlan from "../features/LecturerPlan";
import Tablet from "../layout/Tablet";
import AdminRegistry from "../features/Registry/AdminRegistry";
import Registry from "../features/Registry/Registry";
import AttendancePanel from "../features/AttendancePanel";
import ProtectedRoute from "./ProtectedRoute";
import AccessDenied from "../features/AccessDenied";

export const routes: RouteObject[] = [
    {
        path: '/',
        element: <App />,
        children: [
            {
                path: 'lecturerPlan',
                element: (
                    <ProtectedRoute requirement="lecturer">
                        <LecturerPlan />
                    </ProtectedRoute>
                )
            },
            {
                path: 'attendance/:lessonId',
                element: (
                    <ProtectedRoute requirement="lecturer">
                        <AttendancePanel />
                    </ProtectedRoute>
                )
            },
            { path: 'tablet/:room/:secretUrl', element: <Tablet /> },
            {
                path: 'adminpanel',
                element: (
                    <ProtectedRoute requirement="admin">
                        <AdminRegistry />
                    </ProtectedRoute>
                )
            },
            { path: 'registry', element: <Registry /> },
            { path: 'access-denied', element: <AccessDenied /> }
        ]
    }
]

export const router = createBrowserRouter(routes);
