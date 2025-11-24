import prisma from "../src/lib/prisma";

async function main() {
  const categories = [
    {
      name: "Fashion & Apparel",
      description: "Clothing, shoes, bags, and accessories.",
      iconLib: "Ionicons",
      iconName: "shirt-outline",
    },
    {
      name: "Electronics & Gadgets",
      description: "Smartphones, laptops, headphones, and more.",
      iconLib: "Feather",
      iconName: "smartphone",
    },
    {
      name: "Home & Furniture",
      description: "Furniture, decor, and kitchen appliances.",
      iconLib: "Ionicons",
      iconName: "home-outline",
    },
    {
      name: "Food & Drinks",
      description: "Snacks, groceries, and beverages.",
      iconLib: "Ionicons",
      iconName: "fast-food-outline",
    },
    {
      name: "Real Estate & Property",
      description: "Houses, land, rentals, and offices.",
      iconLib: "Ionicons",
      iconName: "business-outline",
    },
    {
      name: "Vehicles & Auto Parts",
      description: "Cars, bikes, and spare parts.",
      iconLib: "Ionicons",
      iconName: "car-outline",
    },
    {
      name: "Mobile Accessories",
      description: "Chargers, cables, and phone cases.",
      iconLib: "Feather",
      iconName: "headphones",
    },
    {
      name: "Books & Education",
      description: "Books, stationery, and study materials.",
      iconLib: "Ionicons",
      iconName: "book-outline",
    },
    {
      name: "Beauty & Personal Care",
      description: "Makeup, skincare, and fragrances.",
      iconLib: "Ionicons",
      iconName: "color-palette-outline",
    },
    {
      name: "Baby & Kids",
      description: "Toys, clothing, and accessories for kids.",
      iconLib: "Ionicons",
      iconName: "happy-outline",
    },
    {
      name: "Jobs & Services",
      description: "Find skilled professionals and job listings.",
      iconLib: "Ionicons",
      iconName: "briefcase-outline",
    },
    {
      name: "Digital Products",
      description: "Software, templates, and online tools.",
      iconLib: "Ionicons",
      iconName: "cloud-outline",
    },
    {
      name: "Gaming & Consoles",
      description: "Games, consoles, and accessories.",
      iconLib: "Ionicons",
      iconName: "game-controller-outline",
    },
    {
      name: "Pets & Animals",
      description: "Pet food, accessories, and adoptions.",
      iconLib: "Ionicons",
      iconName: "paw-outline",
    },
    {
      name: "Agriculture & Farm",
      description: "Farming tools, livestock, and produce.",
      iconLib: "Ionicons",
      iconName: "leaf-outline",
    },
    {
      name: "Building Materials",
      description: "Cement, steel, and construction supplies.",
      iconLib: "Ionicons",
      iconName: "construct-outline",
    },
    {
      name: "Events & Entertainment",
      description: "Tickets, DJs, and event planning services.",
      iconLib: "Ionicons",
      iconName: "musical-notes-outline",
    },
    {
      name: "Health & Fitness",
      description: "Gym equipment, supplements, and wellness.",
      iconLib: "Ionicons",
      iconName: "fitness-outline",
    },
    {
      name: "Travel & Logistics",
      description: "Flights, transport, and courier services.",
      iconLib: "Ionicons",
      iconName: "airplane-outline",
    },
    {
      name: "Office & Work Tools",
      description: "Printers, desks, and office supplies.",
      iconLib: "Ionicons",
      iconName: "laptop-outline",
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
  }

  console.log("✅ Categories seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
