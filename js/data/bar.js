/* ============================================================
   BAR PACK — Classic Cocktails
   Jimmy's original 16 recipes, unchanged. The adapter at the
   bottom converts them into the generic content-pack shape the
   engine understands (see js/app.js).
   ============================================================ */

(function(){

const cocktails = [
  { name:"White Lady", glass:"Coupe Glass", garnish:"Lemon Peel, Extracted",
    method:"Build in shaking tin and add all ingredients. Dry shake. Add ice, shake and strain.",
    ingredients:[ {amt:"2 oz.",item:"Gin"}, {amt:".75 oz.",item:"Naranja Liqueur"}, {amt:".5 oz.",item:"Lemon Juice"}, {amt:".75 oz.",item:"Egg White"} ] },
  { name:"Old Fashioned", glass:"Rocks Glass", garnish:"Orange Peel and Cherry, Skewered",
    method:"Build in stirring glass, add all ingredients, add ice and stir. Strain over a king cube.",
    ingredients:[ {amt:"2 oz.",item:"Bourbon Whiskey"}, {amt:".25 oz.",item:"Simple Syrup"}, {amt:"2 Dashes",item:"Angostura Bitters"}, {amt:"3-4 Dashes",item:"Orange Bitters"} ] },
  { name:"Last Word", glass:"Chilled Coupe Glass", garnish:"Cherry, Skewered",
    method:"Build in shaking tin, add all ingredients, add ice, shake and strain.",
    ingredients:[ {amt:".75 oz.",item:"Gin"}, {amt:".75 oz.",item:"Green Chartreuse"}, {amt:".75 oz.",item:"Luxardo Maraschino Liqueur"}, {amt:".75 oz.",item:"Lime Juice"} ] },
  { name:"French 75", glass:"Flute Glass", garnish:"Lemon Peel, Extracted",
    method:"Build in shaking tin and add all ingredients except champagne. Add ice, shake and strain. Top with champagne.",
    ingredients:[ {amt:"1.5 oz.",item:"Gin"}, {amt:".5 oz.",item:"Simple Syrup"}, {amt:".5 oz.",item:"Lemon Juice"}, {amt:"3 oz.",item:"Champagne"} ] },
  { name:"Negroni", glass:"Rocks Glass", garnish:"Orange Peel, Extracted",
    method:"Build in stirring glass, add all ingredients, add ice and stir. Strain onto a king cube.",
    ingredients:[ {amt:"1 oz.",item:"Gin"}, {amt:"1 oz.",item:"Carpano Antica Sweet Vermouth"}, {amt:"1 oz.",item:"Campari"} ] },
  { name:"Manhattan", glass:"Rocks Glass (or Chilled Coupe if served up)", garnish:"Cherry, Skewered",
    method:"Build in stirring glass, add all ingredients, add ice and stir. Strain onto a king cube, or up. Can be served up or on the rocks.",
    ingredients:[ {amt:"2 oz.",item:"Rye/Bourbon Whiskey"}, {amt:".75 oz.",item:"Carpano Antica Sweet Vermouth"}, {amt:"2 Dashes",item:"Angostura Bitters"}, {amt:"3-4 Dashes",item:"Orange Bitters"} ] },
  { name:"Aviation", glass:"Chilled Coupe Glass", garnish:"No garnish",
    method:"Build in shaking tin, add all ingredients except Crème de Violet, add ice and shake. Strain, then float Crème de Violet on top.",
    ingredients:[ {amt:"2 oz.",item:"Gin"}, {amt:".75 oz.",item:"Luxardo Maraschino Liqueur"}, {amt:".5 oz.",item:"Lemon Juice"}, {amt:".25 oz.",item:"Crème de Violet Liqueur"} ] },
  { name:"Bees' Knees", glass:"Chilled Coupe Glass", garnish:"Lemon Wheel, Skewered",
    method:"Build in shaking tin, add all ingredients, add ice and shake. Strain into chilled coupe glass.",
    ingredients:[ {amt:"2 oz.",item:"Gin"}, {amt:".5 oz.",item:"Honey Syrup"}, {amt:".5 oz.",item:"Lemon Juice"} ] },
  { name:"Sazerac", glass:"Chilled Coupe", garnish:"Orange Peel, Extracted",
    method:"Build in stirring glass, add all ingredients except absinthe, add ice and stir. Strain into a chilled coupe with an absinthe wash.",
    ingredients:[ {amt:"1.5 oz.",item:"Rye Whiskey"}, {amt:".5 oz.",item:"Brandy"}, {amt:".75 oz.",item:"Simple Syrup"}, {amt:"2-3 Dashes",item:"Peychaud's Bitters"}, {amt:".25 oz.",item:"Absinthe"} ] },
  { name:"Mary Pickford", glass:"Chilled Coupe Glass", garnish:"Cherry, Skewered",
    method:"Build in shaking tin, add all ingredients, shake, and strain.",
    ingredients:[ {amt:"2 oz.",item:"Rum"}, {amt:".75 oz.",item:"Luxardo Maraschino Liqueur"}, {amt:"1.5 oz.",item:"Pineapple Juice"}, {amt:"1 tsp.",item:"Cherry Juice"} ] },
  { name:"Southside", glass:"Chilled Coupe Glass", garnish:"Lime Wheel and Mint Sprig, Skewered",
    method:"Build in shaking tin, add all ingredients, muddle mint, add ice and shake. Double strain.",
    ingredients:[ {amt:"2 oz.",item:"Gin"}, {amt:".5 oz.",item:"Lime Juice"}, {amt:".5 oz.",item:"Simple Syrup"}, {amt:"5-6",item:"Mint Leaves"} ] },
  { name:"Sidecar", glass:"Chilled Coupe with Sugar Rim", garnish:"Orange Peel, Extracted",
    method:"Build in shaking tin, add all ingredients, add ice and shake. Strain into chilled coupe with a sugar rim.",
    ingredients:[ {amt:"2 oz.",item:"Brandy"}, {amt:".75 oz.",item:"Bauchant"}, {amt:".5 oz.",item:"Lemon Juice"} ] },
  { name:"Brandy Crusta", glass:"Georgian Glass with Sugar Rim", garnish:"Whole Orange Peel",
    method:"Build in shaking tin, add all ingredients, add ice and shake. Strain over crushed ice in a Georgian glass with a sugar rim.",
    ingredients:[ {amt:"2 oz.",item:"Brandy"}, {amt:".75 oz.",item:"Bauchant"}, {amt:".5 oz.",item:"Lemon Juice"}, {amt:"2 Dashes",item:"Angostura Bitters"} ] },
  { name:"Corpse Reviver No. 2", glass:"Chilled Coupe with Absinthe Wash", garnish:"No garnish",
    method:"Build in shaking tin, add all ingredients except absinthe, add ice and shake. Strain into chilled coupe with an absinthe wash.",
    ingredients:[ {amt:"2 oz.",item:"Gin"}, {amt:".75 oz.",item:"Bauchant"}, {amt:".5 oz.",item:"Lillet Blanc"}, {amt:".5 oz.",item:"Lemon Juice"}, {amt:".25 oz.",item:"Absinthe"} ] },
  { name:"Paper Plane", glass:"Chilled Coupe", garnish:"Paper Plane",
    method:"Build in shaking tin, add all ingredients, add ice and shake. Strain into chilled coupe glass.",
    ingredients:[ {amt:".75 oz.",item:"Bourbon Whiskey"}, {amt:".75 oz.",item:"Averna Amaro"}, {amt:".75 oz.",item:"Aperol"}, {amt:".75 oz.",item:"Lemon Juice"} ] },
  { name:"The Godfather", glass:"Chilled Rocks Glass", garnish:"Lemon Peel and Cherry, Skewered",
    method:"Build in stirring glass, add all ingredients, add ice and stir. Strain onto a king cube.",
    ingredients:[ {amt:"2 oz.",item:"Scotch"}, {amt:".75 oz.",item:"Luxardo Amaretto"} ] }
];

window.PACKS.push({
  id: "bar",
  icon: "🍸",
  eyebrow: "Bar Exam",
  title: "Classic Cocktails",
  tagline: "16 classics — recipes, pours, glassware and method.",
  role: "Bartender",
  levels: [
    { type:"mcName",       title:"House Pour",     desc:"Multiple choice — name the missing ingredient.", lives:5 },
    { type:"mcAmount",     title:"Measure Up",     desc:"Multiple choice — pick the right measurement.", lives:5 },
    { type:"mcBlank",      count:2, title:"Double Blind",   desc:"Two ingredients vanish at once. Get both right.", lives:5 },
    { type:"mcBlank",      count:3, title:"Call Your Shots",desc:"Three ingredients vanish at once. Get them all right.", lives:5 },
    { type:"mcAllAmounts", title:"Free Pour",      desc:"Every measurement vanishes — pick the right pour for every ingredient.", lives:5 },
    { type:"mcBlank",      count:4, title:"Last Call",      desc:"Four ingredients vanish at once. Get them all right.", lives:5 }
  ],
  items: cocktails.map(c => ({
    name: c.name,
    ingredients: c.ingredients,
    sections: [
      { label:"Glass & Garnish", text: c.glass + " — " + c.garnish },
      { label:"Method", text: c.method }
    ]
  }))
});

})();
