//###########################################################
import fs from "node:fs"
import path from "node:path"

//###########################################################
import { eodsAroundSplitRequest } from "./marketstack.js"


//###########################################################
const readOpts = {encoding: "utf-8"}

//###########################################################
const configPath = path.resolve(process.cwd(), ".config.json")
const config = JSON.parse(fs.readFileSync(configPath, readOpts))
const accessKey = config["access_key"]
if(!accessKey || typeof accessKey != "string") { throw new Error("no access_key found in .config.json !")}

//###########################################################
const splitInfoPath = path.resolve(process.cwd(), "split-info.json")
const splitInfo = JSON.parse(fs.readFileSync(splitInfoPath, readOpts))

if(!Array.isArray(splitInfo)) { throw new Error("split-info.json is not an Array!")}

//###########################################################
const splitToData =  Object.create(null)
const splitToDate = Object.create(null)
const splitsForSymbol = Object.create(null)

//###########################################################
async function retrieveDataAroundSplits() { for(var i = 0; i < splitInfo.length; i++) {
    var split = splitInfo[i]
    var dataKey = split.symbol + split.date + "x" + split.split_factor
    // console.log(dataKey)

    var result = await eodsAroundSplitRequest(split.symbol, split.date, accessKey)
    splitToData[dataKey] = result
    splitToDate[dataKey] = split.date

    if(splitsForSymbol[split.symbol] == undefined) {splitsForSymbol[split.symbol] = []}
    splitsForSymbol[split.symbol].push(dataKey)
}}


//###########################################################
function eodsAroundDate(eodData, date, num) { for(var i = 0; i < eodData.length; i++) {
    var dp = eodData[i] // data point
    const dpDate = dp.date.slice(0,10)
    if(date == dpDate || date > dpDate ) {
        const results = []
        
        // get num previous results
        for(var j = num; j > 0; j--) {
            dp = eodData[i - j]
            if(dp == undefined) { results.push(null) }
            else { results.push({
                close: dp.close,
                adj_close: dp.adj_close,
                split_factor: dp.split_factor,
                date: dp.date.slice(0,10)
            })}
        }

        // get num later results
        for(var j = 0; j <= num; j++) {
            dp = eodData[i + j]
            if(dp == undefined) { results.push(null) }
            else { results.push({
                close: dp.close,
                adj_close: dp.adj_close,
                split_factor: dp.split_factor,
                date: dp.date.slice(0,10)
            })}
        }

        return results
    }
}}

//###########################################################
function summarizeForSymbol(sym) {
    const splitKeys = splitsForSymbol[sym]
    // console.log(splitKeys)

    for(var i = 0; i < splitKeys.length; i++) {
        var key = splitKeys[i]
        var eodFrame = splitToData[key]
        var date = splitToDate[key]

        if(eodFrame.data == undefined) { console.error("No EOD Data for key: "+key+" !") }
        else {
            var result = eodsAroundDate(eodFrame.data, date, 2)
            if(result == undefined) {
                console.error("@"+key+" ["+date+"]: The result was undefined!")
                // console.log(eodFrame.data)
            } else { 
                console.log("@"+key+":")
                console.log(result) 
            }
        }
    }
}

//###########################################################
function summarizeResults() {
    const keys = Object.keys(splitsForSymbol)
    // console.log(keys)
    for(var i = 0; i < keys.length; i++) { summarizeForSymbol(keys[i]) }
}


//###########################################################
async function run() {
    await retrieveDataAroundSplits()
    summarizeResults()
}

//###########################################################
run()