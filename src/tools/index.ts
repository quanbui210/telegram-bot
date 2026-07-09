import {
  checkCalendar,
  insertCalendarEvent,
  modifyCalendarEvent,
  deleteCalendarEvent,
} from "./calendar";
import {
  getStockQuote,
  getPortfolio,
  getHolding,
  buyHolding,
  sellHolding,
  deleteHolding,
} from "./portfolio";

export const tools = [
  checkCalendar,
  insertCalendarEvent,
  modifyCalendarEvent,
  deleteCalendarEvent,
  getStockQuote,
  getPortfolio,
  getHolding,
  buyHolding,
  sellHolding,
  deleteHolding,
];
