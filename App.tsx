import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskProvider } from "@/store/tasks";
import { ReminderRunner } from "@/components/ReminderRunner";
import Today from "./pages/Today";
import Capture from "./pages/Capture";
import TaskDetail from "./pages/TaskDetail";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" richColors closeButton />
      <BrowserRouter>
        <TaskProvider>
          <ReminderRunner />
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TaskProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
