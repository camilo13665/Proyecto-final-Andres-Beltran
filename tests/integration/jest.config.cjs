module.exports={testEnvironment:'node',testMatch:['**/*.test.ts'],preset:'ts-jest',roots:['<rootDir>'],transform:{'^.+\.tsx?$':['ts-jest',{tsconfig:'<rootDir>/tsconfig.integration.json'}]}};
