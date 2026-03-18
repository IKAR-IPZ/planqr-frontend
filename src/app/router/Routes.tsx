import { createBrowserRouter, RouteObject } from "react-router-dom";
import App from "../../App";
import LecturerPlan from "../features/LecturerPlan";
import PlanDetails from "../features/PlanDetails";
import Tablet from "../layout/Tablet";
import AdminRegistry from "../features/Registry/AdminRegistry";
import Registry from "../features/Registry/Registry";
import RequireAuth from "./RequireAuth";

export const routes: RouteObject[] = [
    {
        path: '/',
        element: <App />,
        children: [
            { path: 'LecturerPlan/:teacher', element: <LecturerPlan /> },
            { path: ':department/:room', element: <PlanDetails /> },
            { path: 'tablet/:room/:secretUrl', element: <Tablet /> },
            {
                element: <RequireAuth />,
                children: [
                    { path: 'adminpanel', element: <AdminRegistry /> }
                ]
            },
            { path: 'registry', element: <Registry /> }
        ]
    }
]

export const router = createBrowserRouter(routes);
