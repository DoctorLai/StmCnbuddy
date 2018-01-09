/**
 * The membership management module
 * @author:  MarcoXZh3
 * @version: 1.2.0
 */
const steem = require('steem');


/**
 * The membership setting
 * range is left exclusive, right inclusive
 */
var MEMBERSHIP = {
    'NOT':      { weight:0.01, range:[Number.NEGATIVE_INFINITY, 0] },
    'LEVEL1':   { weight:0.10, range:[0,   100] },
    'LEVEL2':   { weight:0.20, range:[100, 200] },
    'LEVEL3':   { weight:0.30, range:[200, 300] },
    'LEVEL4':   { weight:0.50, range:[300, 500] },
    'LEVEL5':   { weight:0.80, range:[500, 1000] },
    'LEVEL6':   { weight:1.00, range:[1000, Number.POSITIVE_INFINITY] }
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
 * @param {double}      total_vesting_shares        total vesting of steemit
 * @param {double}      total_vesting_fund_steem    total steem of steemit
 * @param {integet}     cnt     (optional) number of voted before this cner
 * @returns {double}            voting weight for the cner
 */
var GetVotingWeight = module.exports.GetVotingWeight =
function(cner, total_vesting_shares, total_vesting_fund_steem, cnt) {
    return MEMBERSHIP[GetMembership(cner,
                                    total_vesting_shares,
                                    total_vesting_fund_steem)
                     ].weight;
}; // var GetVotingWeight = module.exports.GetVotingWeight = function( ... )
