require.paths.unshift "/Users/johnw/js/mumblr_machine"
require.paths.unshift "/Users/johnw/js/mumblr_machine/external"
require.paths.unshift "/Users/johnw/js/mumblr_machine/db"

fs: require 'fs'
coffee: require 'coffee-script'
require "underscore"
 
task 'test', 'run the Mumblr Machine test suite', ->
	process.mixin require 'assert'
	process.mixin require 'sys'
	TestSuite: require('async_testing').TestSuite
	
	passed_count: 0
	failed_count: 0
	test_count: 0
	start_time: new Date()
	[original_ok, original_throws]: [ok, throws]
	process.mixin {
		ok: (v1, v2, msg) ->
			test_count += 1
			if _.isString(v1) or _.isBoolean(v1) or _.isNumber(v1)
				passed: v1 is v2
			else passed: _.isEqual(v1, v2)
			
			if not passed
				puts "\nTest failed: " + msg
				puts "Actual: " + v1
				puts "Expected: " + v2
				failed_count +=1
			else passed_count += 1
		throws: (args...) -> test_count += 1; original_throws(args...)
	}
	process.addListener 'exit', ->
		time: ((new Date() - start_time) / 1000).toFixed(2)
		puts "*********\nAssertions: " + test_count + "\nPassed: " + passed_count + "\nFailed: " + failed_count + "\nTime: " + time + ' seconds'
	fs.readdir 'test', (err, files) ->
		for file in files
			if file.indexOf("js") != -1 
				fs.readFile 'test/' + file, (err, js) ->
					eval(js)