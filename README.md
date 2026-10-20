# Forehead Online

A real-time multiplayer web app for a friends-only guessing game. Includes 54 Marvel Rivals heroes and 173 League of Legends champions (227 total in this roster snapshot).

## Play locally

1. Install Node.js 18 or newer from https://nodejs.org/.
2. Extract this folder.
3. Open a terminal in this folder and run `npm install`.
4. Run `npm start`.
5. Open http://localhost:3000.

Local mode is only reachable from your own computer unless you configure your network. For friends on other devices, deploy the folder to a Node.js host.

## Deploy to Render (online)

1. Upload this folder to a new GitHub repository.
2. Sign in at https://render.com/ and create **New + → Web Service**; connect that repository.
3. Use these settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: a plan that supports a persistent Node web service and WebSockets.
4. Deploy. Render gives you a public `https://...onrender.com` URL. Open that URL and send it to friends.
5. Keep the service running while you play. If you use a free/sleeping plan, the first visit after inactivity may take a little while to wake up.

## Game behaviour

- The host creates a room and optionally sets a password.
- Friends join with the room code and password.
- Host starts the round after at least two players join.
- Each connected player gets a unique character from the selected pack.
- The server does not send a player's own secret character to that player until they guess correctly.
- Other players see each other's assigned characters.
- Guess checks happen on the server. Wrong guesses do not reveal the answer.
- Select Marvel Rivals, League of Legends, or Mixed character packs.
- League champion portraits use Riot Data Dragon. Marvel Rivals portraits attempt a Fandom file URL; if it fails, use the card's Google image-search link. Each character card links to its wiki page.

## Notes

- This is a fan-made, unofficial project. Game names and artwork belong to their owners.
- Roster is a snapshot as of October 2026. Update `rosters.js` when either game adds characters.
- A room's state is in server memory. Restarting/redeploying the server clears active rooms.
