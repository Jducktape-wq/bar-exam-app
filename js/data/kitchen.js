/* ============================================================
   KITCHEN PACK — SAMPLE CONTENT
   ⚠ These recipes are placeholders that demonstrate the pack
   format. Replace every item with the restaurant's actual
   recipes before training real staff. Allergen data below is
   ILLUSTRATIVE ONLY — it must be verified against the real
   recipes by someone qualified before it is shown to a cook.
   ============================================================ */

(function(){

const recipes = [
  { name:"House Marinara", station:"Sauté", yield:"2 qt", holdTime:"3 days refrigerated",
    allergens:"None known (verify oil and canned tomato brands)",
    method:"Sweat garlic in olive oil over medium — no color. Add crushed tomatoes, salt, oregano. Simmer 45 min, stirring every 10. Finish with basil off heat.",
    plating:"Base for pasta dishes. 6 oz ladle per entrée portion.",
    ingredients:[ {amt:"2 Tbsp",item:"Olive Oil"}, {amt:"6 cloves",item:"Garlic, sliced"}, {amt:"2 cans (28 oz)",item:"Crushed Tomatoes"}, {amt:"2 tsp",item:"Kosher Salt"}, {amt:"1 tsp",item:"Dried Oregano"}, {amt:"8 leaves",item:"Fresh Basil"} ] },
  { name:"Buttermilk Fried Chicken Dredge", station:"Fry", yield:"Coats 12 portions", holdTime:"Dredge dry mix: 1 week sealed",
    allergens:"Gluten (flour), Dairy (buttermilk), Egg",
    method:"Whisk dry ingredients. Dip chicken in buttermilk-egg wash, then dredge, pressing to adhere. Rest 10 min on rack before frying at 325°F to internal 165°F.",
    plating:"Rest 3 min on rack, never on paper. Season immediately out of the fryer.",
    ingredients:[ {amt:"4 cups",item:"AP Flour"}, {amt:"2 Tbsp",item:"Paprika"}, {amt:"1 Tbsp",item:"Garlic Powder"}, {amt:"1 Tbsp",item:"Kosher Salt"}, {amt:"2 cups",item:"Buttermilk"}, {amt:"2",item:"Whole Eggs"} ] },
  { name:"Caesar Dressing", station:"Pantry", yield:"1 qt", holdTime:"48 hours refrigerated",
    allergens:"Egg (yolk), Fish (anchovy), Dairy (parmesan)",
    method:"Blend yolks, anchovy, garlic, mustard and lemon. Stream in oil slowly to emulsify. Fold in parmesan last. Season and check acid balance.",
    plating:"2 oz per side salad, 3 oz per entrée salad. Dress to coat, never pool.",
    ingredients:[ {amt:"4",item:"Egg Yolks"}, {amt:"6 fillets",item:"Anchovy"}, {amt:"2 cloves",item:"Garlic"}, {amt:"1 Tbsp",item:"Dijon Mustard"}, {amt:"2 oz.",item:"Lemon Juice"}, {amt:"2 cups",item:"Neutral Oil"}, {amt:"1 cup",item:"Grated Parmesan"} ] },
  { name:"Pan Seared Salmon", station:"Sauté", yield:"1 portion", holdTime:"Fire to order — no hold",
    allergens:"Fish (salmon), Dairy (butter)",
    method:"Pat fillet dry, season. Sear skin-side down in hot oil 4 min until skin releases. Flip, add butter and thyme, baste 2 min to internal 125°F.",
    plating:"Skin up on the purée, sauce around not over. Wipe rim.",
    ingredients:[ {amt:"6 oz.",item:"Salmon Fillet, skin on"}, {amt:"1 Tbsp",item:"Neutral Oil"}, {amt:"2 Tbsp",item:"Butter"}, {amt:"2 sprigs",item:"Fresh Thyme"}, {amt:"1 tsp",item:"Kosher Salt"} ] },
  { name:"Smash Burger", station:"Grill", yield:"1 portion", holdTime:"Fire to order — no hold",
    allergens:"Gluten (bun), Dairy (cheese), Egg + Soy (house sauce)",
    method:"Loose 4 oz ball on the flat top at high heat. Smash hard once, season, 2 min until crust. Flip, cheese, 1 min. Toast bun in the burger's fat.",
    plating:"Sauce both bun faces. Pickles under the patty. Serve within 2 minutes of the flip.",
    ingredients:[ {amt:"4 oz.",item:"Ground Chuck 80/20"}, {amt:"1 slice",item:"American Cheese"}, {amt:"1",item:"Potato Bun"}, {amt:"1 oz.",item:"House Sauce"}, {amt:"4",item:"Pickle Chips"}, {amt:"1 tsp",item:"Kosher Salt"} ] },
  { name:"Chicken Stock", station:"Prep", yield:"6 qt", holdTime:"4 days refrigerated, 3 months frozen",
    allergens:"None known",
    method:"Cover bones with cold water. Bring to bare simmer — never boil. Skim 20 min, add mirepoix and aromatics. Simmer 4 hours, strain, chill fast in ice bath.",
    plating:"Base for soups and pan sauces. Label and date before it goes in the walk-in.",
    ingredients:[ {amt:"5 lbs",item:"Chicken Bones"}, {amt:"6 qt",item:"Cold Water"}, {amt:"2 cups",item:"Mirepoix"}, {amt:"1",item:"Bay Leaf"}, {amt:"6",item:"Black Peppercorns"} ] }
];

window.PACKS.push({
  id: "kitchen",
  icon: "🔪",
  eyebrow: "Line Check",
  title: "Kitchen Recipes",
  tagline: "House recipes — ingredients, stations, method and plating.",
  role: "Cook",
  sample: true,
  levels: [
    { type:"mcName",       title:"Mise en Place",   desc:"Multiple choice — name the missing ingredient.", lives:5 },
    { type:"mcAmount",     title:"Portion Control", desc:"Multiple choice — pick the right quantity.", lives:5 },
    { type:"mcBlank",      count:2, title:"Two in the Weeds", desc:"Two ingredients vanish at once. Get both right.", lives:5 },
    { type:"mcBlank",      count:3, title:"Fire Three",       desc:"Three ingredients vanish at once. Get them all right.", lives:5 },
    { type:"mcAllAmounts", title:"Full Prep",       desc:"Every quantity vanishes — pick the right amount for every ingredient.", lives:5 },
    { type:"mcBlank",      count:4, title:"The Rush",         desc:"Four ingredients vanish at once. Get them all right.", lives:5 }
  ],
  items: recipes.map(r => ({
    name: r.name,
    ingredients: r.ingredients,
    sections: [
      { label:"Station & Yield", text: r.station + " — " + r.yield },
      { label:"Allergens", text: r.allergens },
      { label:"Method", text: r.method },
      { label:"Plating & Hold", text: r.plating + " Hold: " + r.holdTime }
    ]
  }))
});

})();
