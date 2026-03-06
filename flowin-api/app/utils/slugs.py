import random

ADJECTIVES = [
    "amused", "brave", "calm", "cheerful", "chilly", "clever", "cloudy", "cozy", "cranky", "curious",
    "daring", "eager", "fancy", "fuzzy", "gentle", "glossy", "grumpy", "happy", "hollow", "jolly",
    "kind", "lazy", "lofty", "lucky", "messy", "mighty", "nifty", "nimble", "odd", "peppy",
    "perky", "picky", "plucky", "poofy", "quick", "quiet", "quirky", "risky", "shiny", "shy",
    "silly", "sleepy", "slim", "slow", "smug", "snappy", "snug", "soft", "spicy", "stealthy",
    "stormy", "strange", "sunny", "swift", "tame", "thirsty", "tidy", "tiny", "twisty", "vivid",
    "wacky", "warm", "weird", "wild", "witty", "zany", "zesty", "zippy", "bold", "bubbly",
    "feisty", "jazzy", "loopy", "noisy", "sassy", "squeaky", "wavy", "whimsical",
]

NOUNS = [
    "acorn", "alpaca", "apple", "avocado", "bagel", "balloon", "banana", "bison", "blossom", "bubble",
    "cactus", "carrot", "cat", "cloud", "cookie", "crayon", "cupcake", "dolphin", "donut", "dragon",
    "duck", "eagle", "eggplant", "feather", "flamingo", "flower", "fox", "giraffe", "grape", "hamster",
    "hedgehog", "hippo", "honeybee", "iceberg", "iguana", "jellybean", "kangaroo", "koala", "lemon", "lion",
    "llama", "mango", "monkey", "moon", "mushroom", "narwhal", "noodle", "octopus", "otter", "owl",
    "panda", "peach", "peanut", "penguin", "pickle", "pineapple", "popsicle", "potato", "puppy", "quokka",
    "rabbit", "rainbow", "raspberry", "robot", "rocket", "scooter", "shark", "sloth", "snail", "snowman",
    "squid", "starfish", "sunflower", "taco", "teacup", "tiger", "tomato", "tornado", "turtle", "unicorn",
    "waffle", "walrus", "whale", "yak", "zebra",
]


def generate_slug() -> str:
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(1, 99)
    return f"{adj}-{noun}-{num}"
