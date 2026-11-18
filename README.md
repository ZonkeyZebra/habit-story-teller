# Habit Storyteller

## Description
Habit Storyteller is a habit tracker where completing real-life tasks writes an AI-generated story. Users add habits with a schedule and an effort rating, then start a campaign by choosing a hero, genre, notes, and length. Each day they check off habits and press "Tell the next beat" to see the story advance. A chaos meter adds random twists, and the campaign ends in a good, bittersweet, or bad ending depending on how well they kept up. Users can customize both their habits and the story itself.

## Problem This Solves
Most habit trackers are plain checklists, so motivation fades after a few days. Habit Storyteller gamifies the experience: the story only moves forward when you do your habits, and the ending depends on your consistency. This gives users a reason to return each day and makes progress feel meaningful. This will help users maintain motivation and momentum as they aim to develop habits and complete tasks.

## AI Integration
This project integrates AI by having AI as a core feature to create story beats based off of a user's prefernces and the tasks and habits they complete throughout the day. Claude generates each story beat from the user's hero, genre, and notes, and shows the habits they just completed as in-story deeds. To keep the plot consistent, each request includes a rolling summary of the story plus the last three beats, and the AI updates the summary every time. The prompt also includes the user's current habit performance, so the AI steers toward a good, mid, or bad ending, and it adds a twist when the chaos system triggers one. The AI returns structured JSON (story text, summary, headline, collected items) that the app displays and stores. All AI calls go through a server-side proxy, so the API key is never exposed to users.

## How it works
- **Habits:** add tasks with a frequency (daily, certain weekdays, every N days) and an effort rating (1-5 points). Edit them any time; the score is recalculated across the whole campaign from your current habits.
- **Campaigns:** pick a main character, genre, notes and a length in days. Check off habits on **Today**, then press **Tell the next beat**; the completed tasks become in-story deeds.
- **Memory:** each beat sends the AI a rolling story summary plus the last three beats, so the plot stays consistent. The AI updates the summary each time.
- **Chaos:** every beat rolls a d20 plus a bonus from the chaos meter. High rolls trigger a twist and reset the meter; calm beats raise it, so twists get more likely the longer the story is steady. Adjust the 0-100 meter on **Today** to tune the next beat's twist chance.
- **Endings:** at the finale, performance of 75%+ gives a good ending, 45%+ mid, below that bad.
- **Summary:** score, highlights, collected items, and a read-the-whole-story view.