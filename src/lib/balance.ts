/**
 * Cálculo del balance entre el dinero que Yenny entrega y lo que Jose gasta.
 *
 * Todo se opera en centavos enteros. Sumar dólares como decimales acumula
 * errores: 0.1 + 0.2 no da 0.3 exacto, y con suficientes movimientos el
 * balance dejaría de cuadrar contra las facturas.
 */

export type EstadoBalance = 'disponible' | 'a_favor_de_jose' | 'al_dia'

export type Balance = {
  /** Total recibido de Yenny, en dólares */
  totalAportes: number
  /** Total gastado por Jose, en dólares */
  totalGastos: number
  /** Aportes menos gastos. Positivo = sobra, negativo = Jose puso de lo suyo */
  neto: number
  estado: EstadoBalance
  /** El neto sin signo, que es lo que se muestra en pantalla */
  monto: number
}

const aCentavos = (montos: number[]): number =>
  montos.reduce((total, monto) => total + Math.round(monto * 100), 0)

export function calcularBalance(aportesUsd: number[], gastosUsd: number[]): Balance {
  const centavosAportes = aCentavos(aportesUsd)
  const centavosGastos = aCentavos(gastosUsd)
  const centavosNetos = centavosAportes - centavosGastos

  let estado: EstadoBalance = 'al_dia'
  if (centavosNetos > 0) estado = 'disponible'
  else if (centavosNetos < 0) estado = 'a_favor_de_jose'

  return {
    totalAportes: centavosAportes / 100,
    totalGastos: centavosGastos / 100,
    neto: centavosNetos / 100,
    estado,
    monto: Math.abs(centavosNetos) / 100,
  }
}

/**
 * La tasa de cambio que salió en una compra concreta. No se guarda en la base
 * de datos: se deduce de los dos montos, para que no haya dos versiones de la
 * verdad que puedan contradecirse.
 */
export function tasaImplicita(montoBs: number, montoUsd: number): number | null {
  if (montoUsd <= 0) return null
  return Math.round((montoBs / montoUsd) * 100) / 100
}
