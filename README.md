# Charlie Admissions - Clinical Dispatcher System

A modern, real-time clinical admissions dispatcher application built with React, Tailwind CSS, and Supabase. This system helps manage BPS appointment overflow by intelligently routing Individual Contributors (ICs) to available appointment slots when patients no-show.

## Features

### Admin Operations Dashboard
- **Staff Roster Management**: Upload and manage staff members via CSV
- **BPS Slots Upload**: Bulk upload available appointment slots
- **Real-time Data Visualization**: View current staff and slot status

### IC Dashboard (Mobile-Optimized)
- **Simple, Large Interface**: Optimized for mobile use with large touch targets
- **No-Show Reporting**: Giant button to enter reassignment queue when patient no-shows
- **Real-time Assignment Notifications**: Automatically receive new assignments
- **Queue Timer**: Live countdown showing time spent waiting for reassignment

### Manager Command Center
- **Real-time Queue Monitoring**: See ICs waiting for reassignment with live updates
- **Smart Sorting**: Queue sorted by Tier Rank (1-3) then by wait time
- **Dispatch Board**: Two-pane interface for assigning ICs to open slots
- **Live Statistics**: Dashboard showing queue size, open slots, and assignment status

## Tech Stack

- **Frontend**: React 19 with Vite
- **Styling**: Tailwind CSS with custom Charlie Health color scheme
- **Database**: Supabase PostgreSQL with Row Level Security
- **Real-time**: Supabase Realtime for live updates
- **Icons**: Lucide React
- **Routing**: React Router v7
- **CSV Parsing**: PapaParse

## Demo Accounts

For testing, the following demo accounts are pre-loaded:

- **Admin**: admin@clinic.com
- **Manager**: manager@clinic.com
- **IC (Tier 1)**: ic1@clinic.com
- **IC (Tier 2)**: ic2@clinic.com
- **IC (Tier 3)**: ic3@clinic.com

## CSV Upload Formats

### Staff Roster CSV
```csv
email,role,tier_rank
john@clinic.com,IC,1
jane@clinic.com,MANAGER,1
admin@clinic.com,ADMIN,1
```

### BPS Slots CSV
```csv
patient_id,start_time
PAT001,2024-01-15 14:00:00
PAT002,2024-01-15 15:30:00
PAT003,2024-01-15 16:00:00
```

## Application Flow

1. **IC reports no-show**: Clicks "Patient No-Show" button on mobile dashboard
2. **IC enters queue**: Automatically added to reassignment queue with tier rank
3. **Manager monitors queue**: Views sorted list of waiting ICs in real-time
4. **Manager assigns slot**: Selects IC and open BPS slot, confirms dispatch
5. **IC receives assignment**: Automatically notified with new patient details
6. **IC confirms**: Clicks "Confirm & Resume" to accept new assignment

## Build

To create a production build:

```bash
npm run build
```
