# Challenge
This project is created using nodejs, firebase functions and hosted on gcp

## How to run
`npm install`  
`npm run serve`

### Some thoughts for the trolley total api
1. First I tried to figure what is the right payload, by looking the at api sample, the key names are in lowercase which caused my first trouble, then I ngrok to inpect the traffic sent to my local machine then I found out the payload sent by WooliesX server is capitalized first letter.

2. Second problem is how the lowest total get calculated. At a very initial thought, I thought each special can only be applied once only, so I came across the KnapSack problem to try to find an optimal combination of the specials by generated all the subsets for example [1,2,3] => [[],[1],[2],[1,2]] and then calculate all the prices and find the min value

3. Then I found some test cases couldn't pass, then I played around the provided trolley api in depth realized that each specials can be applied more than one time. I noticed this could be a variation of the coin change problem. So I choose Dynamic Programming approaching by defining some base conditions then for each qualified special deal. I track the minimum cost to get the final solution. This solution can be optimized with DP + Memorization.
