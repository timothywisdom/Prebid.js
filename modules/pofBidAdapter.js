import Adapter from 'src/adapter';
import bidfactory from 'src/bidfactory';
import bidmanager from 'src/bidmanager';
import * as utils from 'src/utils';       // useful functions
import { ajax } from 'src/ajax';          // recommended AJAX library
import { STATUS } from 'src/constants';
import adaptermanager from 'src/adaptermanager';

//const PofBidAdapter = function PofBidAdapter() {
function PofBidAdapter() {

    let startTimestamp = 0;

    let _callBids = function(params) {
        startTimestamp = _getTimeStampInMS();

        if (console) console.log("PofBidAdapter has been asked for bids", params);

        // For each bid we want to get an ad and append it to data.placements
        let bids = params.bids || [];
        let adServerURI = "";
        let pofBids = {};
        let pofSlotIDs = [];
        for (let i = 0; i < bids.length; i++) {
            let bid = bids[i];

            if (bid.bidder === "pof" && typeof bid.params !== "undefined" && typeof bid.params.adServerURI !== "undefined" && bid.params.pofSlotID !== 0) {
              // This bid is meant for the pofBidAdapter (actually this is true for all bids that make it here) and there is an adServerURI defined
              adServerURI = bid.params.adServerURI; // + "&bidId=" + bid.bidId;
              pofBids["" + bid.params.pofSlotID] = bid;
              pofSlotIDs.push(bid.params.pofSlotID);
            }
        }

        if (console) console.log("PofBidAdapter: bids", pofBids);

        if (adServerURI === "") {
          // There is no adServerURI so can't get a bid so report error
          if (console) console.log("PofBidAdapter: There is no adServerURI so these bids fail");
          _bidFailed(pofBids);
        } else {
          adServerURI = adServerURI + "&slots=" + pofSlotIDs.join("|");

          // Since adServerURI exists, we'll attempt to get a bid from the Ad Server
          if (console) console.log("PofBidAdapter: Fetching POF Ad Bids", adServerURI);

          // Call the POF Ad Server to get Bid Details
          (function(pofBids){
            ajax(adServerURI, {
                success: function(data) {
                  let timeNow = _getTimeStampInMS();
                  let timeToFetch = Math.round((timeNow - startTimestamp) * 100) / 100;
                  if (console) console.log("PofBidAdapter: Response from Ad Server returned in " + timeToFetch + "ms");

                  _responseCallback(data, pofBids);
                },
                error: function() {
                  let timeNow = _getTimeStampInMS();
                  let timeToFetch = Math.round((timeNow - startTimestamp) * 100) / 100;
                  if (console) console.log("PofBidAdapter: Response from Ad Server returned in " + timeToFetch + "ms");

                  if (console) console.log("PofBidAdapter: AJAX error in fetching pofBidAdapter bid");
                  _bidFailed(pofBids);
                }
              });
          })(pofBids);
        }
    };

    let _bidFailed = function(pofBids) {
      for (let pofSlotID in pofBids) {
        let bid = pofBids[pofSlotID];

        if (console) console.log("PofBidAdapter: failed to fetch bid", bid);
        let bidObject = bidfactory.createBid(STATUS.NO_BID, bid);
        if (console) console.log("PofBidAdapter: bidfactory.createBid(STATUS.NO_BID)", bidObject);
        let adUnitCode = bid.placementCode;
        bidmanager.addBidResponse(adUnitCode, bidObject);
      }      
    };

    // String.prototype._replaceAll = String.prototype._replaceAll || function(search, replacement) {
    //     var target = this;
    //     return target.replace(new RegExp(search, 'g'), replacement);
    // };

    let _getTimeStampInMS = function () {
        return window.performance && window.performance.now && window.performance.timing && window.performance.timing.navigationStart ? window.performance.now() + window.performance.timing.navigationStart : Date.now();
    };

    let _responseCallback = function(data, pofBids) {
        try {
            // Read in the JSON response from the POF Ad Server
            data = JSON.parse(data);

            for (let pofSlotID in pofBids) {
              let bid = pofBids[pofSlotID];
              let bidResponse = data[pofSlotID];

              if (typeof bidResponse !== "undefined") {
                if (console) console.log("PofBidAdapter: Response from POF Ad Server for bid ID " +  bid.bidId + ". Slot ID: " + pofSlotID + ". Repsonse:", bidResponse, "Bid:", bid);

                let adUnitCode = bid.placementCode;
                let bidObject = bidfactory.createBid(STATUS.GOOD, bid);

                if (console) console.log("PofBidAdapter: bidfactory.createBid(STATUS.GOOD)", bidObject);

                bidObject.cpm = bidResponse.cpm; //bidResponse.cpm === 0 ? bidResponse.cpm : 20;
                bidObject.ad = bidResponse.html; //._replaceAll("&lt;", "<")._replaceAll("&gt;", ">")._replaceAll("&#39;", "'")._replaceAll("↵", "");
                bidObject.width = bidResponse.width;
                bidObject.height = bidResponse.height;

                if (console) console.log("PofBidAdapter: Updated bidObject", bidObject);

                // Register this bid with the bidmanager (aka tell Prebid about the POF Ad Server's bid)
                bidmanager.addBidResponse(adUnitCode, bidObject);  
              }
            }

            let timeNow = _getTimeStampInMS();
            let timeToFetch = Math.round((timeNow - startTimestamp) * 100) / 100;
            if (console) console.log("PofBidAdapter: Finished Bid Responses in " + timeToFetch + "ms");

        } catch (error) {
            if (console) console.log("PofBidAdapter: error in response", error);
            _bidFailed(pofBids);
            utils.logError(error);
        }
    };

    // Export the `callBids` function, so that Prebid.js can execute this function when the page asks to send out bid requests.
    return {
        callBids: _callBids
    };

};

adaptermanager.registerBidAdapter(new PofBidAdapter(), 'pof');
module.exports = PofBidAdapter;