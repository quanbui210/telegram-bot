import { google } from 'googleapis';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { env } from '../config/environment';

const auth = new google.auth.JWT({
  email: env.GOOGLE_CLIENT_EMAIL,
  key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/calendar']
});

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = 'quanbui021001@gmail.com';


export const checkCalendar = tool(
  async ({ timeMin, timeMax }) => {
    try {
      const response = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      if (events.length === 0) {
        return 'No events found for this time period.';
      }
      return events
        .map((event) => {
          const start = event.start?.dateTime || event.start?.date;
          const end = event.end?.dateTime || event.end?.date;
          return `- **${event.summary}** (ID: ${event.id}): from ${start} to ${end}`;
        })
        .join('\n');
    } catch (error: any) {
      return `Error retrieving calendar events: ${error.message}`;
    }
  },
  {
    name: 'check_calendar',
    description: 'Check calendar schedules or availability between two points in time. Input strings must be valid ISO timestamps.',
    schema: z.object({
      timeMin: z.string().describe('The start of the ISO timestamp window to check (e.g., 2026-07-06T09:00:00Z)'),
      timeMax: z.string().describe('The end of the ISO timestamp window to check (e.g., 2026-07-06T18:00:00Z)'),
    }),
  }
);

export const insertCalendarEvent = tool(
  async ({ title, startTime, endTime, description }) => {
    try {
      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary: title,
          description: description || 'Created by Personal Assistant Bot',
          start: {
            dateTime: new Date(startTime).toISOString(),
            timeZone: 'Europe/Helsinki', 
          },
          end: {
            dateTime: new Date(endTime).toISOString(),
            timeZone: 'Europe/Helsinki',
          },
        },
      });

      return `Successfully scheduled "${title}" from ${startTime} to ${endTime}. Link: ${response.data.htmlLink}`;
    } catch (error: any) {
      return `Failed to insert calendar event: ${error.message}`;
    }
  },
  {
    name: 'insert_calendar_event',
    description: 'Insert or schedule a new event into the calendar at a specific time.',
    schema: z.object({
      title: z.string().describe('The core objective or summary name of the event'),
      startTime: z.string().describe('The starting ISO timestamp for the meeting'),
      endTime: z.string().describe('The ending ISO timestamp for the meeting'),
      description: z.string().optional().describe('Extra contextual details or location info for the event'),
    }),
  }
);


export const modifyCalendarEvent = tool(
  async ({ eventId, title, startTime, endTime, description }) => {
    try {
      const requestBody: any = {};
      
      if (title) requestBody.summary = title;
      if (description) requestBody.description = description;
      if (startTime) {
        requestBody.start = {
          dateTime: new Date(startTime).toISOString(),
          timeZone: 'Europe/Helsinki',
        };
      }
      if (endTime) {
        requestBody.end = {
          dateTime: new Date(endTime).toISOString(),
          timeZone: 'Europe/Helsinki',
        };
      }

      const response = await calendar.events.patch({
        calendarId: CALENDAR_ID,
        eventId: eventId,
        requestBody: requestBody,
      });

      return `Successfully updated event ID ${eventId}. New details link: ${response.data.htmlLink}`;
    } catch (error: any) {
      return `Failed to modify calendar event: ${error.message}`;
    }
  },
  {
    name: 'modify_calendar_event',
    description: 'Modify or update details of an existing calendar event. Only provide fields that need updating.',
    schema: z.object({
      eventId: z.string().describe('The unique ID of the calendar event to modify (obtained via check_calendar)'),
      title: z.string().optional().describe('The updated title name for the event'),
      startTime: z.string().optional().describe('The updated starting ISO timestamp'),
      endTime: z.string().optional().describe('The updated ending ISO timestamp'),
      description: z.string().optional().describe('The updated context details'),
    }),
  }
);


export const deleteCalendarEvent = tool(
  async ({ eventId }) => {
    try {
      await calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId: eventId,
      });

      return `Successfully deleted event with ID: ${eventId}.`;
    } catch (error: any) {
      return `Failed to delete calendar event: ${error.message}`;
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Completely remove/delete an event from the calendar using its unique eventId.',
    schema: z.object({
      eventId: z.string().describe('The unique ID of the event to delete'),
    }),
  }
);