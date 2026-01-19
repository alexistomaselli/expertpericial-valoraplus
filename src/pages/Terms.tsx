import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="mb-8">
            <Link
              to="/register"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al registro
            </Link>
          </div>

          <div className="prose max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Términos y Condiciones de Uso
            </h1>

            <div className="text-sm text-gray-600 mb-8">
              <p>Última actualización: {new Date().toLocaleDateString('es-ES')}</p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                1. Aceptación de los Términos
              </h2>
              <p className="text-gray-700 mb-4">
                Al acceder y utilizar la plataforma Valora Plus para análisis de rentabilidad 
                de talleres mecánicos, usted acepta estar sujeto a estos términos y condiciones 
                de uso. Si no está de acuerdo con alguno de estos términos, no debe utilizar 
                nuestro servicio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                2. Descripción del Servicio
              </h2>
              <p className="text-gray-700 mb-4">
                Valora Plus es una plataforma que proporciona análisis automatizado de 
                rentabilidad para talleres mecánicos mediante el procesamiento de documentos 
                de valoración pericial. Nuestro servicio incluye:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Análisis automatizado de documentos PDF de valoración</li>
                <li>Cálculo de rentabilidad por reparación</li>
                <li>Generación de reportes detallados</li>
                <li>Gestión de datos de talleres y análisis</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                3. Registro y Cuenta de Usuario
              </h2>
              <p className="text-gray-700 mb-4">
                Para utilizar nuestros servicios, debe crear una cuenta proporcionando 
                información precisa y completa. Usted es responsable de:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Mantener la confidencialidad de sus credenciales de acceso</li>
                <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
                <li>Mantener actualizada la información de su perfil</li>
                <li>Cumplir con todas las leyes aplicables en el uso del servicio</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                4. Uso Aceptable
              </h2>
              <p className="text-gray-700 mb-4">
                Al utilizar nuestro servicio, usted se compromete a:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Utilizar el servicio únicamente para fines legítimos y comerciales</li>
                <li>No cargar documentos que contengan información falsa o fraudulenta</li>
                <li>No intentar acceder a datos de otros usuarios</li>
                <li>No utilizar el servicio para actividades ilegales o no autorizadas</li>
                <li>Respetar los derechos de propiedad intelectual</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                5. Privacidad y Protección de Datos
              </h2>
              <p className="text-gray-700 mb-4">
                La protección de sus datos personales es fundamental para nosotros. 
                Procesamos su información de acuerdo con nuestra Política de Privacidad 
                y en cumplimiento del Reglamento General de Protección de Datos (RGPD) 
                y la legislación española aplicable.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                6. Facturación y Pagos
              </h2>
              <p className="text-gray-700 mb-4">
                Nuestro servicio opera bajo un modelo de pago por uso. Los términos 
                específicos de facturación incluyen:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Tarifas transparentes por análisis procesado</li>
                <li>Facturación automática según el uso del servicio</li>
                <li>Métodos de pago seguros a través de Stripe</li>
                <li>Derecho a suspender el servicio por falta de pago</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                7. Limitación de Responsabilidad
              </h2>
              <p className="text-gray-700 mb-4">
                Valora Plus proporciona análisis automatizados basados en la información 
                contenida en los documentos cargados. No garantizamos la exactitud absoluta 
                de los resultados y recomendamos verificar los cálculos para decisiones 
                comerciales importantes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                8. Modificaciones del Servicio
              </h2>
              <p className="text-gray-700 mb-4">
                Nos reservamos el derecho de modificar, suspender o discontinuar cualquier 
                aspecto del servicio en cualquier momento, con o sin previo aviso. 
                Notificaremos cambios significativos a través de la plataforma o por correo electrónico.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                9. Terminación
              </h2>
              <p className="text-gray-700 mb-4">
                Cualquiera de las partes puede terminar el acuerdo en cualquier momento. 
                Tras la terminación, su acceso al servicio cesará, pero conservaremos 
                sus datos según nuestra Política de Privacidad y las obligaciones legales aplicables.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                10. Ley Aplicable
              </h2>
              <p className="text-gray-700 mb-4">
                Estos términos se rigen por la legislación española. Cualquier disputa 
                será resuelta por los tribunales competentes de España.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                11. Contacto
              </h2>
              <p className="text-gray-700 mb-4">
                Para cualquier consulta sobre estos términos y condiciones, puede contactarnos a través de:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Email: soporte@valoraplus.com</li>
                <li>Teléfono: +34 XXX XXX XXX</li>
                <li>Dirección: [Dirección de la empresa]</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <Link
                to="/register"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Volver al registro
              </Link>
              <Link
                to="/privacy"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                Ver Política de Privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}