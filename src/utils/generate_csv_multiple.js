// mock_gen_product.js
const fs = require("fs");
const readline = require("readline");
const { faker } = require("@faker-js/faker");

// Define possible tags and categories
const possibleTags = [
  "New",
  "Bestseller",
  "Sale",
  "Premium",
  "Limited",
  "Exclusive",
  "Featured",
  "Trending",
  "Popular",
  "Seasonal",
];

const possibleCategories = [
  "Electronics",
  "Gaming",
  "Office",
  "Home",
  "Accessories",
  "Computer",
  "Mobile",
  "Audio",
  "Video",
  "Networking",
];

// Function to get random items from array
function getRandomItems(array, min = 1, max = 3) {
  const count = faker.number.int({ min, max });
  return faker.helpers.arrayElements(array, count);
}

// Function to generate product name using faker
function generateProductName() {
  const department = faker.commerce.department();
  const product = faker.commerce.productName();
  return `${department} ${product}`;
}

// Function to format multiple values for CSV
function formatMultipleValues(values) {
  return `"${values.join(",")}"`;
}

// Function to generate a single product
function generateProduct(index) {
  const tags = getRandomItems(possibleTags);
  const categories = getRandomItems(possibleCategories);

  return {
    ProductID: `P${String(index + 1).padStart(6, "0")}`,
    ProductName: generateProductName(),
    Price: faker.commerce.price({ min: 10, max: 2000, dec: 2 }),
    Quantity: faker.number.int({ min: 1, max: 1000 }),
    Tags: formatMultipleValues(tags),
    Categories: formatMultipleValues(categories),
  };
}

// Function to generate CSV content
function generateCSV(numProducts) {
  const header = "ProductID,ProductName,Price,Quantity,Tags,Categories\n";
  let content = header;

  for (let i = 0; i < numProducts; i++) {
    const product = generateProduct(i);
    content += `${product.ProductID},${product.ProductName},${product.Price},${product.Quantity},${product.Tags},${product.Categories}\n`;
  }

  return content;
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function to prompt user and generate file
function main() {
  rl.question("How many products do you want to generate? ", (answer) => {
    const numProducts = parseInt(answer);

    if (isNaN(numProducts) || numProducts <= 0) {
      console.log("Please enter a valid positive number.");
      rl.close();
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `products_${numProducts}_${timestamp}.csv`;

    try {
      const csvContent = generateCSV(numProducts);
      fs.writeFileSync(fileName, csvContent);
      console.log(
        `Successfully generated ${fileName} with ${numProducts} products!`
      );

      // Display first 5 records as preview
      const preview = csvContent.split("\n").slice(0, 6).join("\n");
      console.log("\nPreview of first 5 records:");
      console.log(preview);

      // Display statistics
      const stats = {
        totalProducts: numProducts,
        possibleTags: possibleTags.length,
        possibleCategories: possibleCategories.length,
        sampleRecord: generateProduct(0),
      };
      console.log("\nGeneration Statistics:");
      console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error("Error generating file:", error);
    }

    rl.close();
  });
}

// Add command line argument support
if (process.argv.length > 2) {
  const numProducts = parseInt(process.argv[2]);
  if (!isNaN(numProducts) && numProducts > 0) {
    const csvContent = generateCSV(numProducts);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `products_${numProducts}_${timestamp}.csv`;
    fs.writeFileSync(fileName, csvContent);
    console.log(`Generated ${fileName} with ${numProducts} products!`);
    process.exit(0);
  }
}

// Run the interactive script if no command line arguments
main();
