import raw from '../data/portfolio.json'
import type { Portfolio } from './types'

export const portfolio = raw as unknown as Portfolio
