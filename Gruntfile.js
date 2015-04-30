var grunt = require('grunt');
require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks

grunt.initConfig({
    babel: {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                'dist/behaviour.js': 'src/behaviour.js'
            }
        }
    }
});

grunt.registerTask('default', ['babel']);