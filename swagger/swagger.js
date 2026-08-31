const YAML = require("yamljs");
const swaggerDocument = YAML.load("./swagger/swagger.yaml");
module.exports = swaggerDocument;