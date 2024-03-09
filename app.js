const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running Success')
    })
  } catch (error) {
    console.log(`DB Error ${error.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const convertStateDbObjectToResponse = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbObjectToRespnse = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//login

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectLoginQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUsers = await db.get(selectLoginQuery)
  if (dbUsers === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUsers.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'My_Secret')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//  get states

app.get('/states/', async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`
  const stateResponse = await db.all(getStatesQuery)
  response.send(
    stateResponse.map(eachState => convertStateDbObjectToResponse(eachState)),
  )
})

//get stateId

app.get('/states/:stateId/', async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `SELECT * FROM state WHERE state_id = ${stateId};`
  const stateResponse = await db.get(getStatesQuery)
  response.send(convertStateDbObjectToResponse(stateResponse))
})

//create district

app.post('/districts/', async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistrictQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES(
    '${districtName}',
    '${stateId}',
    '${cases}',
    '${cured}',
    '${active}',
    '${deaths}'
  );
  `
  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

//get districtId

app.get('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
  const districtResponse = await db.get(getDistrictQuery)
  response.send(convertDistrictDbObjectToRespnse(districtResponse))
})

//delete district

app.delete('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
  const districtResponse = await db.run(getDistrictQuery)
  response.send('District Removed')
})

//update district

app.put('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateDistrictQuery = `
  UPDATE district
  SET district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  WHERE district_id = ${districtId};
  `
  const districtResponse = await db.run(updateDistrictQuery)
  response.send('District Details Updated')
})

// get stat

app.get('/states/:stateId/stats/', async (request, response) => {
  const {stateId} = request.params
  const statsQuery = `
  SELECT SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) As totalDeaths
  FROM district
  WHERE state_id = ${stateId};
  `
  const statsResponse = await db.get(statsQuery)
  response.send(statsResponse)
})

module.exports = app
