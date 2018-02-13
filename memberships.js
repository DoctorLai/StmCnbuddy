/**
 * The membership management module
 * @author:  MarcoXZh3
 * @version: 1.3.1
 */
const steem = require('steem');


/**
 * The membership setting
 * range is left exclusive, right inclusive
 */
var MEMBERSHIP = {
    'NOT':      { weight:0.001, range:[Number.NEGATIVE_INFINITY, 0] },
    'LEVEL1':   { weight:0.050, range:[0,   200] },
    'LEVEL2':   { weight:0.100, range:[200, 300] },
    'LEVEL3':   { weight:0.200, range:[300, 400] },
    'LEVEL4':   { weight:0.300, range:[400, 500] },
    'LEVEL5':   { weight:0.400, range:[500, 600] },
    'LEVLE6':   { weight:0.450, range:[600, 800] },
    'LEVEL7':   { weight:0.500, range:[800, 1000] },
    'LEVEL8':   { weight:0.600, range:[1000, Number.POSITIVE_INFINITY] }
}; // var MEMBERSHIP = { ... };
var epsilon = 1e-8;

/**
 * Calculate and return the member type for a memeber
 * @param {json}        cner                        the cner with delegation
 *      @param {string}     delegator   name of the delegator
 *      @param {date}       time        time of the his/her first delegation
 *      @param {double}     vests       total vests of the delegator
 * @param {double}      total_vesting_shares        total vesting of steemit
 * @param {double}      total_vesting_fund_steem    total steem of steemit
 * @returns {string}                                membership of the delegator
 */
var GetMembership = module.exports.GetMembership =
function(cner, total_vesting_shares, total_vesting_fund_steem) {
    var sp = steem.formatter.vestToSteem(
        cner.vests, total_vesting_shares, total_vesting_fund_steem
    ); // var sp = steem.formatter.vestToSteem( ... );

    var member = null;
    Object.keys(MEMBERSHIP).forEach(function(k) {
        if (member) {
            return ;
        } // if (member)
        var range = MEMBERSHIP[k].range;
        if (sp > range[0] && sp < range[1] + epsilon) {
            member = k;
        } // if (sp > range[0] && sp < range[1] + epsilon)
    }); // Object.keys(MEMBERSHIP).forEach(function(k) { ... });

    return member;
}; // var GetMembership = module.exports.GetMembership = function( ... )


/**
 * Calculate the voting weight for the cner
 * @param {json}        cner    the cner with delegation
 *      @param {string}     delegator   name of the delegator
 *      @param {date}       time        time of the his/her first delegation
 *      @param {double}     vests       total vests of the delegator
 * @param {double}      my_vests        my total vesting
 * @param {double}      total_vesting_shares        total vesting of steemit
 * @param {double}      total_vesting_shares        total vesting of steemit
 * @param {double}      total_vesting_fund_steem    total steem of steemit
 * @param {integet}     cnt     (optional) number of voted before this cner
 * @returns {double}            voting weight for the cner
 */
var GetVotingWeight = module.exports.GetVotingWeight =
function(cner, my_vests, total_vesting_shares, total_vesting_fund_steem, cnt) {
    /*
    return MEMBERSHIP[GetMembership(cner,
                                    total_vesting_shares,
                                    total_vesting_fund_steem)
                     ].weight;
     */

    var sp = steem.formatter.vestToSteem(
        cner.vests, total_vesting_shares, total_vesting_fund_steem
    ); // var sp = steem.formatter.vestToSteem( ... );

    // Determin voting weight based on delegated sp
    if (sp < 0 + epsilon) {             // 0
        return 0.001;
    } else if (sp < 80 + epsilon) {     // 0 ~ 80
        return 0.01;
    } else if (sp < 2000 + epsilon) {   // 80 ~ 2000
        // return negative to indicate that further calculation is required
        return -5 * cner.vests / my_vests;
    } else {                            // > 2000
        return 0.8;
    } // if ... else if ... else ...
}; // var GetVotingWeight = module.exports.GetVotingWeight = function( ... )
