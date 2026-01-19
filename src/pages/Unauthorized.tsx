import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Acceso no autorizado</h1>
      <p className="text-lg mb-6">
        No tienes permisos para acceder a esta sección.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Volver atrás
        </Button>
      </div>
    </div>
  );
};

export default Unauthorized;