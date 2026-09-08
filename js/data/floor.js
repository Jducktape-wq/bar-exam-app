/* ============================================================
   THE FLOOR — STEPS OF SERVICE
   Front-of-house procedures, universal versions. Every card is a
   sequence: amt = step number, item = the step. The quiz tests
   order ("what comes next?") rather than blanks. Restaurants clone
   this and rewrite the steps into their own house way, then add
   their own cards (house greeting, table map, section layout).
   Naming rule as everywhere: same concept, same string.
   ============================================================ */

(function(){

const steps = (...list) => list.map((text, i) => ({ amt: String(i + 1), item: text }));

window.PACKS = window.PACKS || [];
window.PACKS.push({
  id: "floor",
  icon: "👤",
  eyebrow: "The Floor",
  title: "Steps of Service",
  tagline: "The sequence of a great table, from the greet to the goodbye.",
  levels: [
    { type: "mcNext", title: "First Table", desc: "The card shows what you've done so far. What comes next?", lives: 5 },
    { type: "mcName", title: "Full Section", desc: "One step is missing; the rest are hidden. Which step goes there?", lives: 5,
      prompt: "Which step goes here?", sameCard: true },
    { type: "mcNext", title: "Double Sat", desc: "You only know the step you just did. What comes next?", lives: 4, blind: true },
    { type: "mcName", title: "Turn and Burn", desc: "A number and nothing else. Name the step from memory, three lives.", lives: 3,
      prompt: "What is this step?", sameCard: true, hideOthers: true }
  ],
  items: [
    { name: "The First Two Minutes",
      ingredients: steps(
        "Greet the table within two minutes of seating",
        "Introduce yourself by name",
        "Offer water: still or sparkling",
        "Mention tonight's specials and features",
        "Take the drink order",
        "Drop the drinks within five minutes"),
      sections: [
        { label: "Say it like this", text: "\"Hi, welcome in. I'm ___, I'll be taking care of you tonight. Can I start you with still or sparkling?\"" },
        { label: "Why it matters", text: "The first two minutes set the tone and the tip. A greeted table waits patiently; an ignored one counts the seconds." } ] },
    { name: "Taking the Order",
      ingredients: steps(
        "Return when the menus close, not before",
        "Start with the host or whoever catches your eye, then move clockwise",
        "Take appetizers and entrées in one pass",
        "Repeat the order back to the table",
        "Enter it by seat number in the POS",
        "Fire the appetizers, hold the entrées"),
      sections: [
        { label: "Say it like this", text: "\"So that's the redfish for you, medium, and the burger with no onion for you. Perfect.\"" },
        { label: "Why it matters", text: "Seat numbers mean the food goes down without auctioning. Repeating the order catches the mistake before the kitchen does." } ] },
    { name: "Running Food",
      ingredients: steps(
        "Check the ticket against the plates at the pass",
        "Carry by seat number, never auction the food",
        "Set the plate with the protein toward the guest",
        "Announce the dish as you set it down",
        "Ask if they need anything before you walk",
        "Tell the server the table is served"),
      sections: [
        { label: "Say it like this", text: "\"Blackened redfish for you. Anything else I can bring right now?\"" },
        { label: "Why it matters", text: "\"Who had the burger?\" tells the table nobody was paying attention. Seat numbers are the whole trick." } ] },
    { name: "The Check-Back",
      ingredients: steps(
        "Two bites or two minutes, whichever comes first",
        "Ask a real question, not \"is everything okay?\"",
        "Refill drinks without being asked",
        "Pre-bus anything that's finished",
        "Fix a problem on the spot, then tell a manager"),
      sections: [
        { label: "Say it like this", text: "\"How's the redfish cooked for you?\" beats \"everything okay?\" because it can't be answered with a nod." },
        { label: "Why it matters", text: "The check-back is the only chance to fix a plate before it becomes a review." } ] },
    { name: "Dessert and the Check",
      ingredients: steps(
        "Clear and crumb the table",
        "Offer dessert and coffee with a specific suggestion",
        "Drop the check when they ask or the table is clearly done",
        "Run the payment within two minutes",
        "Thank them, by name if you have it",
        "Invite them back"),
      sections: [
        { label: "Say it like this", text: "\"The key lime pie is the one people come back for. Can I bring one with two spoons?\"" },
        { label: "Why it matters", text: "A specific suggestion sells dessert; \"any dessert?\" sells nothing. And a check that sits is a tip that shrinks." } ] },
    { name: "Wine Service",
      ingredients: steps(
        "Present the bottle label-out to the host and read the name and vintage",
        "Cut the foil below the lip and wipe the neck",
        "Pull the cork quietly and set it beside the host",
        "Pour a taste for the host",
        "After approval, pour the guests, host last",
        "Never fill past the widest part of the glass"),
      sections: [
        { label: "Say it like this", text: "\"The 2022 Malbec you ordered.\" Then wait for the nod before you cut the foil." },
        { label: "Why it matters", text: "Wine service is theater; the sequence is the script. Skipping the taste pour is the mistake guests remember." } ] },
    { name: "Handling a Complaint",
      ingredients: steps(
        "Listen without interrupting",
        "Apologize without arguing",
        "Solve it or get a manager within one minute",
        "Follow up before they leave",
        "Thank them for telling you"),
      sections: [
        { label: "Say it like this", text: "\"I'm sorry about that. Let me fix it right now.\" Not \"the kitchen must have...\"" },
        { label: "Why it matters", text: "A guest who complains and gets fixed comes back more often than one who never had a problem. A guest who complains and gets argued with tells ten friends." } ] },
    { name: "Turning the Table",
      ingredients: steps(
        "Clear everything, including the crumbs",
        "Wipe and reset with a fresh setting",
        "Check the chairs and the floor",
        "Tell the host the table is open",
        "Reset your section's water and bread station"),
      sections: [
        { label: "Why it matters", text: "On a Friday, an unreset table is money standing still. The host can't seat what they don't know is open." } ] },
    { name: "Pre-Shift",
      ingredients: steps(
        "Arrive ten minutes early, in uniform",
        "Check tonight's board: specials, 86 list, notes",
        "Taste the special if there is one",
        "Confirm your section with the host",
        "Set your section: water, bread, silverware, menus"),
      sections: [
        { label: "Why it matters", text: "The shift is won before the first table sits. Everything you didn't set up now becomes a run you make later." } ] },
    { name: "Closing Side Work",
      ingredients: steps(
        "Clear and reset every table in your section",
        "Marry and wipe the condiments",
        "Restock the station: napkins, silver, glassware",
        "Sweep your section",
        "Check out with the manager before you leave"),
      sections: [
        { label: "Why it matters", text: "Tomorrow's opener inherits tonight's side work. Nobody leaves until the section is checked." } ] }
  ]
});

})();
