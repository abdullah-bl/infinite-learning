// Courses the mock model writes for these topics, so the sky can be seen full: clusters of
// subjects that share ideas and point at each other, as real courses do. Only for looking at the
// interface; the backend tests don't use them.

type Fixture = { title: string; description: string; lessons: { title: string; concepts: string[] }[]; nextTopics: string[] };

const rows = `
black holes | how black holes work | What happens when gravity wins, from collapsing stars to the edge no light escapes. | how stars die; gravitational waves; the big bang; einstein's relativity
  what makes a black hole: gravity, escape velocity, collapsing stars
  the event horizon: event horizon, spacetime curvature, time dilation
  how we see them: accretion disks, gravitational waves, event horizon telescope
how stars die | how stars die | Red giants, white dwarfs and supernovae: the ends a star's mass decides. | black holes; the big bang; exoplanets; nuclear fusion
  a star's fuel: nuclear fusion, hydrogen burning, stellar mass
  red giants and white dwarfs: red giants, white dwarfs, planetary nebulae
  supernovae: supernovae, neutron stars, collapsing stars
the big bang | the big bang, plainly | How the universe began hot and dense, and the evidence we still see. | dark matter; how stars die; einstein's relativity; black holes
  an expanding universe: cosmic expansion, redshift, hubble's law
  the first light: cosmic microwave background, recombination, redshift
  the first atoms: nuclear fusion, hydrogen and helium, inflation theory
exoplanets | finding exoplanets | How astronomers find planets around other stars, and which might hold life. | how stars die; the search for alien life; telescopes
  wobbling stars: radial velocity, doppler shift, stellar mass
  passing shadows: transit method, light curves, planet size
  could anything live there: habitable zone, atmospheres, liquid water
dark matter | dark matter and dark energy | The ninety-five percent of the universe we can't see, and how we know it's there. | the big bang; black holes; einstein's relativity
  missing mass: galaxy rotation curves, dark matter, gravitational lensing
  what it could be: wimps, axions, modified gravity
  dark energy: dark energy, cosmic expansion, the fate of the universe
how chatbots like chatgpt work | how chatbots like chatgpt work | What a language model is, how it learns from text, and why it sometimes makes things up. | neural networks; transformers; ai image generators; prompt engineering
  predicting the next word: language models, tokens, probability
  learning from text: training data, neural networks, parameters
  why they make things up: hallucinations, fine-tuning, human feedback
neural networks | neural networks from scratch | Neurons, weights and learning by small corrections, without the maths getting in the way. | transformers; how chatbots like chatgpt work; ai image generators
  a neuron in code: artificial neurons, weights, activation functions
  learning by correction: gradient descent, loss functions, backpropagation
  going deep: deep learning, layers, overfitting
transformers | transformers and attention | The idea behind every modern language model: letting each word look at every other. | how chatbots like chatgpt work; neural networks; prompt engineering
  attention: attention, tokens, context window
  the transformer block: self-attention, embeddings, layers
  scaling up: parameters, training data, scaling laws
ai image generators | how ai image generators work | From noise to a picture: diffusion models and the words that steer them. | neural networks; how chatbots like chatgpt work; copyright and ai
  starting from noise: diffusion models, noise, denoising
  words that steer: text embeddings, prompts, embeddings
  where the pictures come from: training data, copyright and ai, bias in ai
prompt engineering | prompt engineering | How to ask a language model for what you want, and check what it gives back. | how chatbots like chatgpt work; transformers
  clear instructions: prompts, context window, examples in prompts
  making it reason: chain of thought, hallucinations, checking answers
inflation | what inflation is | Why prices rise, who it hurts, and what central banks do about it. | interest rates; how money is created; recessions
  prices over time: inflation, purchasing power, consumer price index
  why prices rise: money supply, demand and supply, wages and prices
  fighting it: central banks, interest rates, recessions
interest rates | how interest rates work | What an interest rate is, who sets it, and how it reaches your mortgage and savings. | inflation; how stock markets work; how money is created
  the price of money: interest rates, compound interest, risk
  the central bank's lever: central banks, policy rate, inflation
  your loans and savings: mortgages, compound interest, bonds
how stock markets work | how stock markets work | What owning a share means, why prices move, and how indexes track it all. | interest rates; cryptocurrency; recessions
  owning a piece: shares, companies, dividends
  why prices move: demand and supply, risk, expectations
  the whole market: index funds, diversification, compound interest
cryptocurrency | cryptocurrency, explained | What a blockchain is, how bitcoin works, and the risks before buying any. | how stock markets work; how money is created
  a shared ledger: blockchain, ledgers, cryptography
  bitcoin: bitcoin, mining, proof of work
  the risks: volatility, scams, risk
how money is created | how money is created | Banks, central banks and loans: where new money actually comes from. | inflation; interest rates; cryptocurrency
  what money is: money, trust, purchasing power
  banks make money: loans, money supply, fractional reserve banking
  the central bank: central banks, quantitative easing, inflation
how sleep works | how sleep works | Why we sleep, what happens in each stage, and what makes a good night. | memory; the immune system; habits
  the sleep cycle: sleep stages, rem sleep, deep sleep
  your body clock: circadian rhythm, melatonin, light and sleep
  why it matters: memory, the immune system, sleep debt
memory | how memory works | How the brain stores what you learn, and why spacing your reviews helps. | how sleep works; habits; learning faster
  making a memory: short-term memory, long-term memory, the hippocampus
  forgetting: the forgetting curve, interference, sleep and memory
  remembering better: spaced repetition, retrieval practice, memory
habits | how habits form | The loop behind every habit, and how to build or break one. | memory; how sleep works; motivation
  the habit loop: cues, routines, rewards
  building one: habit stacking, small steps, consistency
  breaking one: triggers, replacing routines, dopamine
the immune system | the immune system | How your body tells friend from foe, and remembers every fight. | how vaccines work; gut microbiome; how sleep works
  the first line: innate immunity, inflammation, white blood cells
  learning the enemy: antibodies, t cells, b cells
  remembering: immune memory, antibodies, how vaccines work
how vaccines work | how vaccines work | Teaching the immune system with a safe preview of a germ. | the immune system; gut microbiome
  a safe preview: antigens, how vaccines work, immune memory
  kinds of vaccine: mrna vaccines, inactivated vaccines, boosters
  protecting everyone: herd immunity, side effects, antibodies
gut microbiome | the gut microbiome | The trillions of microbes in your gut, and what they do for you. | the immune system; how sleep works
  who lives there: bacteria, gut microbiome, diversity
  what they do: digestion, fibre, the immune system
how batteries work | how batteries work | Lithium, ions and why your phone battery wears out. | electric cars; solar power; climate change
  moving ions: ions, anodes and cathodes, electrolytes
  lithium-ion: lithium-ion batteries, energy density, charging
  wearing out: battery degradation, charge cycles, recycling batteries
electric cars | how electric cars work | Motors, batteries and charging: what's different under the floor. | how batteries work; solar power; climate change
  the motor: electric motors, regenerative braking, torque
  the battery: lithium-ion batteries, energy density, range
  charging: charging, the power grid, charge cycles
solar power | how solar power works | How a panel turns sunlight into electricity, and how a grid copes when the sun sets. | how batteries work; climate change; electric cars
  sunlight to current: photovoltaic cells, semiconductors, photons
  panels and homes: inverters, efficiency, rooftop solar
  when the sun sets: the power grid, energy storage, lithium-ion batteries
climate change | climate change basics | The greenhouse effect, what the evidence shows, and what can be done. | solar power; electric cars; how batteries work
  the greenhouse effect: greenhouse effect, carbon dioxide, global warming
  the evidence: temperature records, ice cores, sea level rise
  what can be done: renewable energy, carbon capture, energy storage
the printing press | the printing press | How movable type changed who could read, write and argue. | the silk road; the scientific revolution
  gutenberg's press: movable type, the printing press, ink and paper
  books for everyone: literacy, the reformation, pamphlets
the silk road | the silk road | Trade routes that carried silk, paper, ideas and plague across Asia and Europe. | the printing press; the black death
  routes and goods: the silk road, caravans, silk
  ideas on the move: paper, religions spread, trade
`;

const ar = `
الثقوب السوداء | كيف تعمل الثقوب السوداء | ماذا يحدث حين تنتصر الجاذبية، من انهيار النجوم إلى الحدّ الذي لا يفلت منه الضوء. | كيف تموت النجوم; الانفجار العظيم; النسبية
  ما الثقب الأسود: الجاذبية، سرعة الإفلات، انهيار النجوم
  أفق الحدث: أفق الحدث، انحناء الزمكان، تمدد الزمن
كيف تموت النجوم | كيف تموت النجوم | العمالقة الحمراء والأقزام البيضاء والمستعرات العظمى. | الثقوب السوداء; الانفجار العظيم
  وقود النجم: الاندماج النووي، كتلة النجم، الهيدروجين
  النهايات: المستعرات العظمى، النجوم النيوترونية، انهيار النجوم
كيف تعمل روبوتات الدردشة | كيف تعمل روبوتات الدردشة مثل ChatGPT | ما النموذج اللغوي، وكيف يتعلّم من النصوص، ولماذا يختلق أحياناً. | الشبكات العصبية; هندسة الأوامر
  توقّع الكلمة التالية: النماذج اللغوية، الرموز، الاحتمال
  التعلّم من النصوص: بيانات التدريب، الشبكات العصبية، المعاملات
الشبكات العصبية | الشبكات العصبية من الصفر | الخلايا والأوزان والتعلّم بالتصحيح، دون أن تعيقك الرياضيات. | كيف تعمل روبوتات الدردشة
  خلية في الشيفرة: الخلايا الاصطناعية، الأوزان، دوال التنشيط
  التعلّم بالتصحيح: الانحدار التدريجي، الشبكات العصبية، التعلّم العميق
التضخم | ما هو التضخم | لماذا ترتفع الأسعار، ومن يتضرر، وماذا تفعل البنوك المركزية. | أسعار الفائدة; الركود
  الأسعار عبر الزمن: التضخم، القوة الشرائية، مؤشر الأسعار
  مكافحته: البنوك المركزية، أسعار الفائدة، الركود
أسعار الفائدة | كيف تعمل أسعار الفائدة | ما سعر الفائدة، ومن يحدده، وكيف يصل إلى قرضك ومدخراتك. | التضخم
  ثمن المال: أسعار الفائدة، الفائدة المركبة، المخاطرة
  أداة البنك المركزي: البنوك المركزية، التضخم، القروض
كيف يعمل النوم | كيف يعمل النوم | لماذا ننام، وما يحدث في كل مرحلة، وما الذي يصنع ليلة جيدة. | الذاكرة; العادات
  دورة النوم: مراحل النوم، نوم حركة العين السريعة، النوم العميق
  ساعة الجسم: الإيقاع اليومي، الميلاتونين، الذاكرة
الذاكرة | كيف تعمل الذاكرة | كيف يخزّن الدماغ ما تتعلّمه، ولماذا تساعد المراجعة المتباعدة. | كيف يعمل النوم; العادات
  صناعة الذكرى: الذاكرة قصيرة المدى، الذاكرة طويلة المدى، الحُصين
  التذكّر أفضل: التكرار المتباعد، الاسترجاع، منحنى النسيان
`;

function parse(text: string) {
  const out: Record<string, Fixture> = {};
  let cur: Fixture | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (!line.startsWith("  ")) {
      const [topic, title, description, next] = line.split(" | ");
      cur = { title, description, lessons: [], nextTopics: next.split("; ") };
      out[topic.trim()] = cur;
    } else if (cur) {
      const [title, ideas] = line.trim().split(": ");
      cur.lessons.push({ title, concepts: ideas.split(/,|،/).map((c) => c.trim()) });
    }
  }
  return out;
}

export const skyFixtures: Record<string, Fixture> = { ...parse(rows), ...parse(ar) };

/** A lesson body long enough to pass as one, written from its ideas. */
export function fixtureCourse(f: Fixture, arabic: boolean) {
  return {
    title: f.title,
    description: f.description,
    nextTopics: f.nextTopics,
    lessons: f.lessons.map((l) => ({
      title: l.title,
      concepts: l.concepts,
      content: arabic
        ? `يشرح هذا الدرس ${l.concepts.join(" و")}.\n\nنبدأ بـ**${l.concepts[0]}** بمثال من الحياة اليومية، ثم نربطه بما بعده.\n\n### النقاط الرئيسية\n\n- ${l.concepts.join("\n- ")}`
        : `This lesson explains ${l.concepts.join(", ")}.\n\nWe start with **${l.concepts[0]}** through an everyday example, then connect it to the next idea.\n\n### Key points\n\n- ${l.concepts.join("\n- ")}`,
    })),
  };
}
