/* ============================================================
   INDUSTRY BASICS — ESPRESSO DRINKS
   Universal knowledge: the espresso ladder is the same in every
   café. These are real build specs, so this pack uses the full
   recipe mechanics including amounts. Ratios follow common US
   specialty-coffee practice; shops can edit after cloning. No
   allergen data by design (library packs never carry it).
   ============================================================ */

(function(){

window.PACKS = window.PACKS || [];
window.PACKS.push({
  id: "espresso",
  icon: "☕",
  eyebrow: "Industry Basics",
  title: "Espresso Drinks",
  tagline: "The whole espresso ladder, from solo shot to affogato.",
  levels: [
    { type: "mcName", title: "Pull the Shot", desc: "Multiple choice — name the missing component.", lives: 5,
      prompt: "Which component completes this drink?" },
    { type: "mcAmount", title: "Dial It In", desc: "Multiple choice — pick the right amount.", lives: 5 },
    { type: "mcBlank", count: 1, title: "Ticket Check", desc: "One full line vanishes, amount and all. Rebuild it.", lives: 5,
      noun: "component" },
    { type: "mcAllAmounts", title: "Morning Rush", desc: "Every amount vanishes — pick the right one for each component.", lives: 4 }
  ],
  items: [
    { name: "Espresso",
      ingredients: [ { amt: "1 oz.", item: "Espresso (single shot)" } ],
      sections: [
        { label: "Cup & Serve", text: "3 oz. demitasse, saucer and spoon." },
        { label: "Method", text: "25 to 30 second pull. Golden crema on top means it's right; serve immediately, crema fades in a minute." } ] },
    { name: "Doppio",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" } ],
      sections: [
        { label: "Cup & Serve", text: "3 oz. demitasse." },
        { label: "Method", text: "A double shot; 'doppio' is Italian for double. This is the default shot size in most US cafés." } ] },
    { name: "Americano",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "6 oz.", item: "Hot water" } ],
      sections: [
        { label: "Cup & Serve", text: "8 to 12 oz. mug." },
        { label: "Method", text: "Water first, then shots on top to keep the crema. Tastes closest to drip coffee; that's the guest translation." } ] },
    { name: "Latte",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "8 oz.", item: "Steamed milk" }, { amt: "Thin layer", item: "Milk foam" } ],
      sections: [
        { label: "Cup & Serve", text: "12 oz. cup or glass." },
        { label: "Method", text: "Shots first, steamed milk poured through, just a whisper of foam. The mildest, milkiest drink on the ladder." } ] },
    { name: "Cappuccino",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "3 oz.", item: "Steamed milk" }, { amt: "3 oz.", item: "Milk foam" } ],
      sections: [
        { label: "Cup & Serve", text: "6 oz. cup, classically." },
        { label: "Method", text: "Equal thirds: espresso, steamed milk, foam. Drier and stronger-tasting than a latte; that's the difference guests ask about." } ] },
    { name: "Flat White",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "4 oz.", item: "Steamed milk (velvet microfoam)" } ],
      sections: [
        { label: "Cup & Serve", text: "6 oz. cup." },
        { label: "Method", text: "Like a small, strong latte with no foam cap; the milk is steamed to a paint-like microfoam. Australian import." } ] },
    { name: "Cortado",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "2 oz.", item: "Steamed milk" } ],
      sections: [
        { label: "Cup & Serve", text: "4 to 5 oz. glass, traditionally." },
        { label: "Method", text: "Equal parts espresso and milk; 'cortado' means cut. For guests who want espresso with the edge taken off." } ] },
    { name: "Macchiato",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "Dollop", item: "Milk foam" } ],
      sections: [
        { label: "Cup & Serve", text: "3 oz. demitasse." },
        { label: "Method", text: "Espresso 'marked' with a spoonful of foam. Warn guests: this is NOT the large caramel drink from the chains; ask which one they mean." } ] },
    { name: "Mocha",
      ingredients: [ { amt: "2 oz.", item: "Espresso (double shot)" }, { amt: "1 oz.", item: "Chocolate sauce" }, { amt: "6 oz.", item: "Steamed milk" }, { amt: "Optional cap", item: "Whipped cream" } ],
      sections: [
        { label: "Cup & Serve", text: "12 oz. mug." },
        { label: "Method", text: "Chocolate and shots stirred first, then milk. The dessert end of the coffee menu; an easy yes for non-coffee people." } ] },
    { name: "Affogato",
      ingredients: [ { amt: "1 scoop", item: "Vanilla gelato or ice cream" }, { amt: "2 oz.", item: "Espresso (double shot), poured hot" } ],
      sections: [
        { label: "Cup & Serve", text: "Small glass or coupe, spoon required." },
        { label: "Method", text: "Hot shots poured over cold gelato at the table if you can; the melt is the show. 'Affogato' means drowned." } ] }
  ]
});

})();
