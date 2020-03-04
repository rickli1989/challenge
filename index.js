const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const rp = require('request-promise');
const R = require('ramda');
const CONFIG = require('./config');
admin.initializeApp(functions.config().firebase);
const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));

app.get('/execise1/user', async (req, res) => {
  res.send({
    "name": CONFIG.USER,
    "token": CONFIG.TOKEN
  });
});

app.get('/execise2/sort', async (req, res) => {
  var options = {
    method: "GET",
    uri: `${CONFIG.HOST}/products?token=${CONFIG.TOKEN}`,
    headers: {
      "content-type": "application/json"
    },
    json: true
  };
  let results = await rp(options);

  const sortOption = req.query.sortOption;
  if (sortOption) {
    if (!Object.values(CONFIG.SORT_OPTION_TYPES).includes(sortOption)) { //check the sort parameter is valid
      res.status(500).send({
        error: 'Invalid sort parameter'
      })
    } else {
      if (sortOption === CONFIG.SORT_OPTION_TYPES.LOW) {
        results = R.sortWith([
          R.ascend(R.prop('price'))
        ])(results)
      } else if (sortOption === CONFIG.SORT_OPTION_TYPES.HIGH) {
        results = R.sortWith([
          R.descend(R.prop('price'))
        ])(results)
      } else if (sortOption === CONFIG.SORT_OPTION_TYPES.ASCENDING) {
        results = R.sortWith([
          R.ascend(R.prop('name'))
        ])(results)
      } else if (sortOption === CONFIG.SORT_OPTION_TYPES.DESCENDING) {
        results = R.sortWith([
          R.descend(R.prop('name'))
        ])(results)
      } else if (sortOption === CONFIG.SORT_OPTION_TYPES.RECOMMENDED) {
        var optionsR = {
          method: "GET",
          uri: `${CONFIG.HOST}/shopperHistory?token=${CONFIG.TOKEN}`,
          headers: {
            "content-type": "application/json"
          },
          json: true
        };
        let recommendedResults = await rp(optionsR);

        results = R.compose(
          R.flatten,
          d => R.append(            //append the missing product list to the end which has no history
            R.differenceWith((a, b) => a.name === b.name, results, d)
          )(d),
          R.sortWith([R.descend(R.prop("quantity"))]),     //Sort by popularity
          R.values,          //Convert object array to array
          R.mapObjIndexed(
            (num, name, obj) => {
              let price = R.compose(     //Calculate the sum of price based on product name
                R.prop("price"),
                R.head,
              )(num)
              let quantity = R.compose(  //Calculate the sum of quantity based on the product name
                R.sum,
                R.map(R.prop('quantity'))
              )(num);
              return {
                name,
                price,
                quantity
              };
            }
          ),
          R.groupBy(R.prop("name")),   //Group by the product name
          R.flatten,    //Flatten the nested array into flat array
          R.map(    //Get all products array regardless of customerId
            R.prop("products")
          )
        )(recommendedResults)
      }
    }
  }
  res.send(results);
});

app.post('/execise3/trolleyTotal', async (req, res) => {
  //Check some mandatory fields
  if (!req.body.Products) {
    res.status(400).json({
      "Products": [
        "The Products field is required."
      ]
    })
  }
  if (!req.body.Specials) {
    res.status(400).json({
      "Products": [
        "The Specials field is required."
      ]
    })
  }
  if (!req.body.Quantities) {
    res.status(400).json({
      "Products": [
        "The Quantities field is required."
      ]
    })
  }

  //This function calculate the quantites left after applying a single special object
  const calcSpe = (quantities, sp) => R.compose(
    R.values,
    R.mapObjIndexed(
      (num, key, obj) => {
        return {
          Name: key,
          Quantity: num[1].Quantity - num[0].Quantity > 0 ? num[1].Quantity - num[0].Quantity : 0 //Using required quantity minus the special quantity
        };
      }
    ),
    R.groupBy(R.prop("Name")),
    R.concat(
      sp
    )
  )(quantities)

  //This function caclute the products total value after applying the specials
  const calcProduct = (quantities, products) => R.compose(
    R.sum,
    R.values,
    R.mapObjIndexed(
      (num, key, obj) => {
        return num[0].Price * num[1].Quantity;
      }
    ),
    R.groupBy(R.prop("Name")),
    R.concat(products),
  )(quantities)

  //This function filters out the special deals which has the quantity required greater than the quantity asked
  const allMatch = quantities => specials => {
    let all = true;
    for (let s of specials) {
      let findQ = R.find(
        R.propEq("Name", s.Name)
      )(quantities)

      if (s.Quantity > findQ.Quantity) all = false
    }
    return all;
  }

  //This function filter out the specials that not meet the min quantity
  const filterSpecial = (specials, quantities) => R.compose(
    R.filter(
      R.compose(
        allMatch(quantities),
        R.prop("Quantities")
      )
    ),
    R.filter(
      d => d.Total > 0
    )
  )(specials)


  let products = req.body.Products;
  let specials = req.body.Specials;
  let quantities = req.body.Quantities;

  //Filter out unqualified sepecials
  const filteredSpecials = filterSpecial(specials, quantities);

  //This function generate all combinations of specials array. For example [1,2] => [[], [1], [2], [1,2]]
  // const subSets = specials => specials.reduce((subsets, value) => {
  //   return subsets.concat(
  //     subsets.map(set => [...set, value])
  //   )
  // }, [[]]);
  // const allSubsets = subSets(filteredSpecials)
  /*
    The strategy to solve this problem is like a KnapSack Problem, every special can either be applied
    or not applied. We can simply generate all specials combinations then apply to the quantities, 
    then sum with the product value if there is still quantitites after specials applied.
  */
  // for (let sub of allSubsets) {
  //   if (sub.length === 0) { //no specials
  //     results.push(calcProduct(quantities, products));
  //   } else {
  //     let quantitiesLeft = [...quantities];
  //     let total = 0;
  //     for(sp of sub) {  //Calculate the total for the specials applied
  //       quantitiesLeft = calcSpe(quantitiesLeft, sp.Quantities);
  //       total += sp.Total;
  //     }
  //     let productSumLeft = calcProduct(quantitiesLeft, products); //Calculate the product value after specials been applied
  //     total += productSumLeft
  //     results.push(total);
  //   }
  // }
  // results.push(calcProduct(quantities, products));

  // This function check whether all the quantites are 0 now
  const emptyCapacity = quantities => {
    return R.all(R.equals(0))(R.map(R.prop('Quantity'))(quantities));
  };

  // This function check the specific special can be used for the supplied quantity
  var canSubstractSpecial = (spe, quantities) => {
    if(
      R.compose(
        allMatch(quantities),
        R.prop("Quantities")
      )(spe)
    ) return true;

    return false;
  }

  // This function checks if any special in the specials array cannot be used
  var cantApplyAnySpecial = (spe, quantities) => {
    let all = [];

    for (let sp of spe) {
      let subAll = []
      for (let s of sp.Quantities) {
        let findQ = R.find(
          R.propEq("Name", s.Name)
        )(quantities)
        if (s.Quantity <= findQ.Quantity) subAll.push(true);
        else subAll.push(false);
      }
      // if(subAll[0] === true && subAll[1] === true)
      if (R.all(R.equals(true))(subAll))
        all.push(true);
      else 
        all.push(false);
    }
    return R.all(R.equals(false))(all);
  }

  // This function calculate the left quantity required after been applied a special deal
  var substractQuantity = (quantities, spe) => {
    return R.map(
      d => Object.assign({}, d, 
        {
          Quantity: d.Quantity - R.compose(
                                  R.prop("Quantity"), 
                                  R.find(R.propEq("Name", d.Name))
                                )(spe.Quantities)
        }
      )
    )(quantities)
  }

  /*
    This solution is similar to coin change problem like given a total of 11, what is the minimum coins
    required give coins [1,2,5]; This is a dynamic programming problem with some variations to the coin
    change problem. Here we need to consider all the combinations of special deals combine with the total
    of product value. For each special deal, we can either applied 0-n times. I used min to track the 
    minimum value of the total price = calcProduct + specials total
  */
  var minSpecialCombo = function (filteredSpecials, quantities) {
    var res = helper(filteredSpecials, quantities);
    return res === Number.POSITIVE_INFINITY ? calcProduct(quantities, products) : res;
  };

  var helper = function (filteredSpecials, quantities) {
    if (emptyCapacity(quantities)) return 0;
    if (cantApplyAnySpecial(filteredSpecials, quantities)) return calcProduct(quantities, products);
    var min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < filteredSpecials.length; i++) {
      if (canSubstractSpecial(filteredSpecials[i], quantities)) {
        var sub = helper(filteredSpecials, substractQuantity(quantities, filteredSpecials[i]));
        if (sub !== Number.POSITIVE_INFINITY && sub + filteredSpecials[i].Total < min){
          min = sub + filteredSpecials[i].Total;
        }
      }
    }
    return min;
  }

  const minSpecialTotal = minSpecialCombo(filteredSpecials, quantities);
  res.send((minSpecialTotal).toString());
});


exports.wooliesxApi = functions.region("asia-northeast1").https.onRequest(app);