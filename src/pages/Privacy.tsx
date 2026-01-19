import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Eye, Lock, UserCheck } from "lucide-react";

export default function Privacy() {
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
            <div className="text-center mb-8">
              <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Política de Privacidad
              </h1>
              <p className="text-gray-600">
                Protegemos tu privacidad y datos personales conforme al RGPD
              </p>
            </div>

            <div className="text-sm text-gray-600 mb-8 p-4 bg-blue-50 rounded-lg">
              <p><strong>Última actualización:</strong> {new Date().toLocaleDateString('es-ES')}</p>
              <p><strong>Responsable del tratamiento:</strong> Valora Plus</p>
            </div>

            <section className="mb-8">
              <div className="flex items-center mb-4">
                <UserCheck className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-800">
                  1. Información que Recopilamos
                </h2>
              </div>
              <p className="text-gray-700 mb-4">
                Recopilamos la siguiente información para proporcionar nuestros servicios 
                de análisis de rentabilidad para talleres mecánicos:
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-gray-800 mb-2">Datos de Registro:</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Nombre completo</li>
                  <li>Dirección de correo electrónico</li>
                  <li>Número de teléfono</li>
                  <li>Nombre del taller mecánico</li>
                  <li>Contraseña (encriptada)</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-gray-800 mb-2">Datos de Uso:</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Documentos PDF de valoración pericial cargados</li>
                  <li>Resultados de análisis generados</li>
                  <li>Historial de transacciones y pagos</li>
                  <li>Logs de actividad en la plataforma</li>
                  <li>Datos técnicos (IP, navegador, dispositivo)</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center mb-4">
                <Eye className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-800">
                  2. Cómo Utilizamos su Información
                </h2>
              </div>
              <p className="text-gray-700 mb-4">
                Utilizamos sus datos personales para los siguientes propósitos legítimos:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Servicios Principales:</h3>
                  <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    <li>Procesamiento de documentos PDF</li>
                    <li>Generación de análisis de rentabilidad</li>
                    <li>Gestión de cuenta de usuario</li>
                    <li>Soporte técnico y atención al cliente</li>
                  </ul>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Operaciones Comerciales:</h3>
                  <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    <li>Facturación y procesamiento de pagos</li>
                    <li>Comunicaciones sobre el servicio</li>
                    <li>Mejora de nuestros servicios</li>
                    <li>Cumplimiento de obligaciones legales</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center mb-4">
                <Lock className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-800">
                  3. Base Legal para el Tratamiento
                </h2>
              </div>
              <p className="text-gray-700 mb-4">
                Procesamos sus datos personales basándonos en las siguientes bases legales 
                conforme al RGPD:
              </p>
              
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-gray-800">Ejecución de Contrato</h3>
                  <p className="text-gray-700 text-sm">
                    Para proporcionar los servicios de análisis que ha contratado
                  </p>
                </div>
                
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-gray-800">Consentimiento</h3>
                  <p className="text-gray-700 text-sm">
                    Para comunicaciones de marketing (puede retirar el consentimiento en cualquier momento)
                  </p>
                </div>
                
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold text-gray-800">Interés Legítimo</h3>
                  <p className="text-gray-700 text-sm">
                    Para mejorar nuestros servicios y garantizar la seguridad de la plataforma
                  </p>
                </div>
                
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold text-gray-800">Obligación Legal</h3>
                  <p className="text-gray-700 text-sm">
                    Para cumplir con requisitos fiscales y de facturación
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                4. Compartir Información con Terceros
              </h2>
              <p className="text-gray-700 mb-4">
                No vendemos ni alquilamos sus datos personales. Compartimos información 
                únicamente en las siguientes circunstancias:
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Proveedores de Servicios:</h3>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                  <li><strong>Supabase:</strong> Almacenamiento de datos y autenticación</li>
                  <li><strong>Stripe:</strong> Procesamiento de pagos</li>
                  <li><strong>OpenAI:</strong> Procesamiento de documentos PDF</li>
                  <li><strong>Proveedores de hosting:</strong> Infraestructura de la plataforma</li>
                </ul>
              </div>
              
              <p className="text-gray-700 text-sm">
                Todos nuestros proveedores están obligados contractualmente a proteger 
                sus datos y solo pueden usarlos para los fines específicos que les hemos autorizado.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                5. Sus Derechos bajo el RGPD
              </h2>
              <p className="text-gray-700 mb-4">
                Como residente de la UE, tiene los siguientes derechos sobre sus datos personales:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded">
                    <h3 className="font-semibold text-blue-800 text-sm">Derecho de Acceso</h3>
                    <p className="text-gray-700 text-xs">Solicitar una copia de sus datos personales</p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded">
                    <h3 className="font-semibold text-green-800 text-sm">Derecho de Rectificación</h3>
                    <p className="text-gray-700 text-xs">Corregir datos inexactos o incompletos</p>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded">
                    <h3 className="font-semibold text-red-800 text-sm">Derecho de Supresión</h3>
                    <p className="text-gray-700 text-xs">Solicitar la eliminación de sus datos</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-purple-50 p-3 rounded">
                    <h3 className="font-semibold text-purple-800 text-sm">Derecho de Portabilidad</h3>
                    <p className="text-gray-700 text-xs">Recibir sus datos en formato estructurado</p>
                  </div>
                  
                  <div className="bg-yellow-50 p-3 rounded">
                    <h3 className="font-semibold text-yellow-800 text-sm">Derecho de Oposición</h3>
                    <p className="text-gray-700 text-xs">Oponerse al procesamiento de sus datos</p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <h3 className="font-semibold text-gray-800 text-sm">Derecho de Limitación</h3>
                    <p className="text-gray-700 text-xs">Restringir el procesamiento de sus datos</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                6. Seguridad de los Datos
              </h2>
              <p className="text-gray-700 mb-4">
                Implementamos medidas de seguridad técnicas y organizativas apropiadas para 
                proteger sus datos personales:
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Lock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-blue-800 text-sm">Encriptación</h3>
                  <p className="text-gray-700 text-xs">Datos encriptados en tránsito y en reposo</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-green-800 text-sm">Acceso Controlado</h3>
                  <p className="text-gray-700 text-xs">Acceso limitado solo a personal autorizado</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Eye className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-purple-800 text-sm">Monitoreo</h3>
                  <p className="text-gray-700 text-xs">Supervisión continua de la seguridad</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                7. Retención de Datos
              </h2>
              <p className="text-gray-700 mb-4">
                Conservamos sus datos personales durante el tiempo necesario para cumplir 
                con los fines para los que fueron recopilados:
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Datos de cuenta:</strong> Mientras mantenga su cuenta activa</li>
                <li><strong>Datos de facturación:</strong> 7 años (requisito legal fiscal)</li>
                <li><strong>Documentos procesados:</strong> 2 años o hasta solicitud de eliminación</li>
                <li><strong>Logs de actividad:</strong> 1 año para fines de seguridad</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                8. Transferencias Internacionales
              </h2>
              <p className="text-gray-700 mb-4">
                Algunos de nuestros proveedores de servicios pueden estar ubicados fuera 
                del Espacio Económico Europeo. En estos casos, garantizamos que se implementen 
                las salvaguardias adecuadas conforme al RGPD.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                9. Contacto y Ejercicio de Derechos
              </h2>
              <p className="text-gray-700 mb-4">
                Para ejercer sus derechos o realizar consultas sobre esta política de privacidad:
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li><strong>Email:</strong> privacidad@valoraplus.com</li>
                  <li><strong>Teléfono:</strong> +34 XXX XXX XXX</li>
                  <li><strong>Dirección:</strong> [Dirección de la empresa]</li>
                  <li><strong>Delegado de Protección de Datos:</strong> dpo@valoraplus.com</li>
                </ul>
              </div>
              
              <p className="text-gray-700 text-sm mt-4">
                También tiene derecho a presentar una reclamación ante la Agencia Española 
                de Protección de Datos (AEPD) si considera que el tratamiento de sus datos 
                personales infringe la normativa aplicable.
              </p>
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
                to="/terms"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                Ver Términos y Condiciones
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}