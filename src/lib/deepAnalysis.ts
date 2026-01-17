/**
 * Deep Analysis Engine - Generates rich, detailed prediction insights
 * Provides comprehensive context for why predictions are made
 */

import { FixtureInput } from "./advancedPredictionEngine";

export interface DetailedAnalysis {
  formAnalysis: string;
  defensiveStrength: string;
  attackingPower: string;
  headToHeadInsight: string;
  homeAwayDynamics: string;
  matchupMismatches: string[];
  keyBattles: string[];
  possibleOutcomes: string[];
  riskFactors: string[];
  tacticalConsiderations: string;
  injuryImpact: string;
}

export class DeepAnalysisEngine {
  /**
   * Generates comprehensive analysis for a fixture
   */
  analyze(fixture: FixtureInput): DetailedAnalysis {
    return {
      formAnalysis: this.analyzeForm(fixture),
      defensiveStrength: this.analyzeDefense(fixture),
      attackingPower: this.analyzeAttack(fixture),
      headToHeadInsight: this.analyzeHeadToHead(fixture),
      homeAwayDynamics: this.analyzeHomeAwayDynamics(fixture),
      matchupMismatches: this.identifyMismatches(fixture),
      keyBattles: this.identifyKeyBattles(fixture),
      possibleOutcomes: this.generateOutcomes(fixture),
      riskFactors: this.identifyRiskFactors(fixture),
      tacticalConsiderations: this.analyzeTactics(fixture),
      injuryImpact: this.analyzeInjuries(fixture),
    };
  }

  /**
   * Deep form analysis with trend interpretation
   */
  private analyzeForm(fixture: FixtureInput): string {
    const homeForm = fixture.home_team.recent_form;
    const awayForm = fixture.away_team.recent_form;

    const homeWins = homeForm.split("").filter((r) => r === "W").length;
    const homeLosses = homeForm.split("").filter((r) => r === "L").length;
    const awayWins = awayForm.split("").filter((r) => r === "W").length;
    const awayLosses = awayForm.split("").filter((r) => r === "L").length;

    let analysis = "";

    // Home team form
    if (homeForm[homeForm.length - 1] === "W") {
      analysis += `${fixture.home_team.name} are in excellent form, winning their most recent match. `;
    } else if (homeForm[homeForm.length - 1] === "L") {
      analysis += `${fixture.home_team.name} suffered a recent loss and will be looking to respond. `;
    }

    // Form momentum
    if (homeWins >= 3) {
      analysis += `With ${homeWins} wins in their last ${homeForm.length} games, they're on a strong run. `;
    } else if (homeLosses >= 2) {
      analysis += `Their recent form shows ${homeLosses} losses which is concerning. `;
    }

    // Away team form
    if (awayForm[awayForm.length - 1] === "W") {
      analysis += `${fixture.away_team.name} are also in strong form after a recent win. `;
    } else if (awayForm[awayForm.length - 1] === "L") {
      analysis += `${fixture.away_team.name} come into this match in poor form after a recent defeat. `;
    }

    // Comparative analysis
    if (homeWins > awayWins) {
      analysis += `${fixture.home_team.name} have been more consistent, recording ${homeWins} wins versus ${awayWins} for ${fixture.away_team.name}.`;
    } else if (awayWins > homeWins) {
      analysis += `${fixture.away_team.name} have a superior record with ${awayWins} wins versus ${homeWins} for ${fixture.home_team.name}.`;
    } else {
      analysis += `Both teams have identical recent form with ${homeWins} wins each, setting up an intriguing contest.`;
    }

    return analysis;
  }

  /**
   * Defensive strength analysis
   */
  private analyzeDefense(fixture: FixtureInput): string {
    const homeGoalsAgainst = fixture.home_team.goals_against;
    const awayGoalsAgainst = fixture.away_team.goals_against;
    const homeGoalsFor = fixture.home_team.goals_for;
    const awayGoalsFor = fixture.away_team.goals_for;

    const homeDefenseRating = 100 - Math.min(100, (homeGoalsAgainst / 30) * 100);
    const awayDefenseRating = 100 - Math.min(100, (awayGoalsAgainst / 30) * 100);

    let analysis = "";

    if (homeDefenseRating > awayDefenseRating + 10) {
      analysis += `${fixture.home_team.name} boast a significantly stronger defense with only ${homeGoalsAgainst} goals conceded. `;
      analysis += `This defensive solidity could be crucial against ${fixture.away_team.name}'s attacks. `;
    } else if (awayDefenseRating > homeDefenseRating + 10) {
      analysis += `${fixture.away_team.name} have an impressive defensive record, conceding just ${awayGoalsAgainst} goals. `;
      analysis += `Their discipline could frustrate ${fixture.home_team.name}'s attacking ambitions. `;
    } else {
      analysis += `Both teams have comparable defensive records. `;
      analysis += `${fixture.home_team.name} have conceded ${homeGoalsAgainst} while ${fixture.away_team.name} have conceded ${awayGoalsAgainst}. `;
    }

    // High-scoring tendency
    if (homeGoalsFor > 40 && awayGoalsFor > 40) {
      analysis += "Expect an open, entertaining match with both teams capable of scoring freely.";
    } else if (
      homeGoalsAgainst > 35 ||
      awayGoalsAgainst > 35
    ) {
      analysis +=
        "At least one team has shown defensive vulnerabilities that could be exploited.";
    }

    return analysis;
  }

  /**
   * Attacking power analysis
   */
  private analyzeAttack(fixture: FixtureInput): string {
    const homeGoalsFor = fixture.home_team.goals_for;
    const awayGoalsFor = fixture.away_team.goals_for;
    const homeGoalDiff = fixture.home_team.goals_for - fixture.home_team.goals_against;
    const awayGoalDiff = fixture.away_team.goals_for - fixture.away_team.goals_against;

    let analysis = "";

    if (homeGoalsFor > awayGoalsFor + 5) {
      analysis += `${fixture.home_team.name}'s attacking prowess is evident with ${homeGoalsFor} goals scored. `;
      analysis += `This offensive threat could overwhelm ${fixture.away_team.name}. `;
    } else if (awayGoalsFor > homeGoalsFor + 5) {
      analysis += `${fixture.away_team.name} are the more prolific attacking force with ${awayGoalsFor} goals. `;
      analysis += `${fixture.home_team.name} will need to be defensively disciplined. `;
    } else {
      analysis += `Both teams have similar attacking output. `;
    }

    // Goal difference analysis
    if (homeGoalDiff > awayGoalDiff) {
      analysis += `${fixture.home_team.name}'s goal difference of +${homeGoalDiff} is superior, suggesting balanced, effective play.`;
    } else if (awayGoalDiff > homeGoalDiff) {
      analysis += `${fixture.away_team.name}'s goal difference of +${awayGoalDiff} indicates more efficient attacking play.`;
    }

    return analysis;
  }

  /**
   * Head-to-head historical context
   */
  private analyzeHeadToHead(fixture: FixtureInput): string {
    if (!fixture.head_to_head) {
      return "No previous encounters between these teams in the available data.";
    }

    const h2h = fixture.head_to_head;
    const homeWins = h2h.home_wins || 0;
    const awayWins = h2h.away_wins || 0;
    const draws = h2h.draws || 0;
    const total = homeWins + awayWins + draws;

    if (total === 0) {
      return "No previous head-to-head record available.";
    }

    let analysis = `In their ${total} previous meetings: `;

    if (homeWins > awayWins + draws) {
      analysis += `${fixture.home_team.name} have dominated with ${homeWins} wins, `;
      analysis += `suggesting they have a psychological edge and tactical advantage. `;
    } else if (awayWins > homeWins + draws) {
      analysis += `${fixture.away_team.name} have the superior record with ${awayWins} wins, `;
      analysis += `showing they have historically found ${fixture.home_team.name}'s style difficult to play against. `;
    } else {
      analysis += `the record is balanced with ${homeWins} home wins and ${awayWins} away wins. `;
    }

    if (draws > 0) {
      analysis += `There have been ${draws} draws, indicating closely contested matches.`;
    }

    return analysis;
  }

  /**
   * Home/away advantage analysis
   */
  private analyzeHomeAwayDynamics(fixture: FixtureInput): string {
    const homeHome =
      (fixture.home_team.home_wins || 0) +
      (fixture.home_team.home_draws || 0) +
      (fixture.home_team.home_losses || 0);
    const homeAway =
      (fixture.away_team.away_wins || 0) +
      (fixture.away_team.away_draws || 0) +
      (fixture.away_team.away_losses || 0);

    const homeWinRate =
      homeHome > 0
        ? ((fixture.home_team.home_wins || 0) / homeHome) * 100
        : 0;
    const awayWinRate =
      homeAway > 0
        ? ((fixture.away_team.away_wins || 0) / homeAway) * 100
        : 0;

    let analysis = "";

    if (homeWinRate > 45) {
      analysis += `${fixture.home_team.name} are formidable at home with a ${Math.round(homeWinRate)}% home win rate. `;
    }
    if (awayWinRate < 35) {
      analysis += `${fixture.away_team.name} struggle on the road with just ${Math.round(awayWinRate)}% away wins. `;
    } else if (awayWinRate > 40) {
      analysis += `${fixture.away_team.name} are strong travelers with a ${Math.round(awayWinRate)}% away win rate. `;
    }

    analysis += `This dynamic could significantly influence the match outcome.`;

    return analysis;
  }

  /**
   * Identify tactical mismatches
   */
  private identifyMismatches(fixture: FixtureInput): string[] {
    const mismatches: string[] = [];
    const homeGoalDiff =
      fixture.home_team.goals_for - fixture.home_team.goals_against;
    const awayGoalDiff =
      fixture.away_team.goals_for - fixture.away_team.goals_against;

    // Attacking vs defensive
    if (
      fixture.home_team.goals_for > 35 &&
      fixture.away_team.goals_against > 40
    ) {
      mismatches.push(
        `${fixture.home_team.name}'s prolific attack could exploit ${fixture.away_team.name}'s defensive weaknesses`
      );
    }

    if (
      fixture.away_team.goals_for > 35 &&
      fixture.home_team.goals_against > 40
    ) {
      mismatches.push(
        `${fixture.away_team.name}'s attacking threat poses serious problems for ${fixture.home_team.name}'s leaky defense`
      );
    }

    // League position contrast
    if (
      Math.abs(
        fixture.home_team.league_position - fixture.away_team.league_position
      ) > 5
    ) {
      const higher =
        fixture.home_team.league_position < fixture.away_team.league_position
          ? fixture.home_team.name
          : fixture.away_team.name;
      mismatches.push(
        `Significant league position gap suggests ${higher} should control proceedings`
      );
    }

    return mismatches;
  }

  /**
   * Identify key individual/team battles
   */
  private identifyKeyBattles(fixture: FixtureInput): string[] {
    const battles: string[] = [];

    // Form-based
    battles.push(
      `${fixture.home_team.name}'s recent form vs ${fixture.away_team.name}'s defensive organization`
    );
    battles.push(
      `${fixture.away_team.name}'s traveling strength vs ${fixture.home_team.name}'s home record`
    );

    // Attack vs Defense
    if (
      fixture.home_team.goals_for > 40 ||
      fixture.away_team.goals_for > 40
    ) {
      battles.push("Attacking flair will be tested against defensive discipline");
    }

    // Possession battles
    battles.push(
      `Midfield control - whichever team dominates the middle will likely dictate the match`
    );

    return battles;
  }

  /**
   * Generate possible match outcomes with context
   */
  private generateOutcomes(fixture: FixtureInput): string[] {
    const outcomes: string[] = [];
    const homeGoalDiff =
      fixture.home_team.goals_for - fixture.home_team.goals_against;
    const awayGoalDiff =
      fixture.away_team.goals_for - fixture.away_team.goals_against;

    if (
      homeGoalDiff > awayGoalDiff &&
      fixture.home_team.league_position < fixture.away_team.league_position
    ) {
      outcomes.push(
        `${fixture.home_team.name} secure a comfortable home victory using their superior form and home advantage`
      );
    }

    if (
      awayGoalDiff > homeGoalDiff &&
      fixture.away_team.league_position < fixture.home_team.league_position
    ) {
      outcomes.push(
        `${fixture.away_team.name} pull off an impressive away win despite entering as underdogs`
      );
    }

    outcomes.push(
      `A tightly contested match ending in a draw if defensive discipline prevails`
    );
    outcomes.push(
      `An open, entertaining encounter with multiple goals if defensive vulnerabilities are exploited`
    );

    return outcomes;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(fixture: FixtureInput): string[] {
    const risks: string[] = [];

    // Form instability
    if (
      fixture.home_team.recent_form.includes("L") ||
      fixture.away_team.recent_form.includes("L")
    ) {
      risks.push("Recent defeats could affect confidence and mentality");
    }

    // Defensive concerns
    if (
      fixture.home_team.goals_against > 40 ||
      fixture.away_team.goals_against > 40
    ) {
      risks.push("Defensive vulnerabilities could be exposed");
    }

    // Inconsistency
    if (
      fixture.home_team.recent_form.includes("W") &&
      fixture.home_team.recent_form.includes("L")
    ) {
      risks.push(
        `${fixture.home_team.name}'s inconsistent form makes them unpredictable`
      );
    }

    if (
      fixture.away_team.recent_form.includes("W") &&
      fixture.away_team.recent_form.includes("L")
    ) {
      risks.push(
        `${fixture.away_team.name}'s inconsistent form makes them unpredictable`
      );
    }

    // Away struggles
    if (fixture.away_team.away_losses && fixture.away_team.away_losses > 5) {
      risks.push("Away team's poor traveling record is a significant concern");
    }

    return risks;
  }

  /**
   * Tactical considerations
   */
  private analyzeTactics(fixture: FixtureInput): string {
    let tactics = "";

    const homeForm = fixture.home_team.recent_form;
    const awayForm = fixture.away_team.recent_form;

    if (homeForm.startsWith("W")) {
      tactics +=
        `${fixture.home_team.name} are likely to play with confidence and tempo. `;
    } else {
      tactics +=
        `${fixture.home_team.name} may adopt a more cautious approach initially. `;
    }

    if (
      fixture.away_team.goals_against > fixture.home_team.goals_against
    ) {
      tactics +=
        `${fixture.away_team.name} will need to be disciplined defensively to contain the home team's attacks. `;
    }

    if (fixture.home_team.league_position < 8) {
      tactics +=
        `The home team's superior league position suggests they should dominate possession. `;
    }

    tactics +=
      `Set pieces could be decisive - teams will look to capitalize on any opportunities.`;

    return tactics;
  }

  /**
   * Analyze injury impact
   */
  private analyzeInjuries(fixture: FixtureInput): string {
    const homeInjuries = fixture.home_team.injuries?.length || 0;
    const awayInjuries = fixture.away_team.injuries?.length || 0;

    if (homeInjuries === 0 && awayInjuries === 0) {
      return "Both teams appear to have a full squad available, which should ensure competitive balance.";
    }

    let analysis = "";

    if (homeInjuries > 0) {
      analysis += `${fixture.home_team.name} have ${homeInjuries} player${homeInjuries > 1 ? "s" : ""} unavailable. `;
    }

    if (awayInjuries > 0) {
      analysis += `${fixture.away_team.name} have ${awayInjuries} player${awayInjuries > 1 ? "s" : ""} unavailable. `;
    }

    if (homeInjuries > awayInjuries) {
      analysis += `This injury situation favors ${fixture.away_team.name}.`;
    } else if (awayInjuries > homeInjuries) {
      analysis += `This injury situation favors ${fixture.home_team.name}.`;
    }

    return analysis;
  }
}
