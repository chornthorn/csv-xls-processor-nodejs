// mock_gen_product.js
const fs = require("fs");
const readline = require("readline");
const { faker } = require("@faker-js/faker");

// Function to generate product name using faker
function generateProductName() {
  const department = faker.commerce.department();
  const product = faker.commerce.productName();
  return `${department} ${product}`;
}

// Function to generate a single product
function generateProduct(index) {
  return {
    ProductID: `P${String(index + 1).padStart(6, "0")}`,
    ProductName: generateProductName(),
    Price: faker.commerce.price({ min: 10, max: 2000, dec: 2 }),
    Quantity: faker.number.int({ min: 1, max: 1000 }),
  };
}

// Function to generate CSV content
function generateCSV(numProducts) {
  const header = "ProductID,ProductName,Price,Quantity\n";
  let content = header;

  for (let i = 0; i < numProducts; i++) {
    const product = generateProduct(i);
    content += `${product.ProductID},${product.ProductName},${product.Price},${product.Quantity}\n`;
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
    } catch (error) {
      console.error("Error generating file:", error);
    }

    rl.close();
  });
}

// Run the script
main();
