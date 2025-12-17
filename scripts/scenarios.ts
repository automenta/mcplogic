export interface Scenario {
    id: string;
    title: string;
    description: string;
    text: string;
    expectedGoal?: string; // If known
    type: 'prove' | 'consistency';
}

export const SCENARIOS: Scenario[] = [
    {
        id: 'socrates',
        title: 'Socrates Syllogism',
        description: 'The classic example of deductive reasoning.',
        text: 'All men are mortal. Socrates is a man. Therefore, Socrates is mortal.',
        type: 'prove',
        expectedGoal: 'mortal(socrates)'
    },
    {
        id: 'birds',
        title: 'Tweety the Bird',
        description: 'Handling exceptions and classification.',
        text: 'All birds fly. Penguins are birds. Penguins do not fly. Tweety is a penguin. Therefore, Tweety does not fly.',
        type: 'prove',
        expectedGoal: '-fly(tweety)'
    },
    {
        id: 'knights_knaves',
        title: 'Knights and Knaves',
        description: 'A logic puzzle involving truth-tellers and liars.',
        text: 'A knight always tells the truth. A knave always lies. Alice says "Bob is a knave". Bob says "Alice and I are both knaves". Prove that Alice is a knave.',
        type: 'prove',
        expectedGoal: 'knave(alice)'
    },
    {
        id: 'math_parity',
        title: 'Even and Odd Numbers',
        description: 'Simple arithmetic reasoning.',
        text: 'The sum of two even numbers is even. 2 is even. 4 is even. Therefore, 2 plus 4 is even.',
        type: 'prove',
        expectedGoal: 'even(plus(2, 4))'
    },
    {
        id: 'agatha',
        title: 'Who Killed Agatha?',
        description: 'A complex murder mystery (TPTP PUZ001).',
        text: 'Agatha, the butler, and Charles live in Dreadbury Mansion. Someone who lives there killed Agatha. A killer always hates and is not richer than the victim. Charles hates everyone except Agatha. Agatha hates everyone except the butler. The butler hates everyone not richer than Agatha. The butler hates everyone Agatha hates. No one hates everyone. Agatha is not the butler. Prove that Agatha killed herself.',
        type: 'prove',
        expectedGoal: 'killed(agatha, agatha)'
    }
];
