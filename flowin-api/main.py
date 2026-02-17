from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os

app = FastAPI()

SITES_DIR = "/var/www/flowin-sites"
BASE_DOMAIN = "flowin.one"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://editor.flowin.one"],
    allow_methods=["POST"],
    allow_headers=["*"]
)


import os
import random
import string


adjectives = [
    "amused", "brave", "calm", "cheerful", "chilly", "clever", "cloudy", "cozy", "cranky", "curious",
    "daring", "eager", "fancy", "fuzzy", "gentle", "glossy", "grumpy", "happy", "hollow", "jolly",
    "kind", "lazy", "lofty", "lucky", "messy", "mighty", "nifty", "nimble", "odd", "peppy",
    "perky", "picky", "plucky", "poofy", "quick", "quiet", "quirky", "risky", "shiny", "shy",
    "silly", "sleepy", "slim", "slow", "smug", "snappy", "snug", "soft", "spicy", "stealthy",
    "stormy", "strange", "sunny", "swift", "tame", "thirsty", "tidy", "tiny", "twisty", "vivid",
    "wacky", "warm", "weird", "wild", "witty", "zany", "zesty", "zippy", "bold", "bubbly",
    "fancy", "feisty", "jazzy", "loopy", "noisy", "quirky", "sassy", "squeaky", "wavy", "whimsical"
]

nouns = [
    "acorn", "alpaca", "apple", "avocado", "bagel", "balloon", "banana", "bison", "blossom", "bubble",
    "cactus", "carrot", "cat", "cloud", "cookie", "crayon", "cupcake", "dolphin", "donut", "dragon",
    "duck", "eagle", "eggplant", "feather", "flamingo", "flower", "fox", "giraffe", "grape", "hamster",
    "hedgehog", "hippo", "honeybee", "iceberg", "iguana", "jellybean", "kangaroo", "koala", "lemon", "lion",
    "llama", "mango", "monkey", "moon", "mushroom", "narwhal", "noodle", "octopus", "otter", "owl",
    "panda", "peach", "peanut", "penguin", "pickle", "pineapple", "popsicle", "potato", "puppy", "quokka",
    "rabbit", "rainbow", "raspberry", "robot", "rocket", "scooter", "shark", "sloth", "snail", "snowman",
    "squid", "starfish", "sunflower", "taco", "teacup", "tiger", "tomato", "tornado", "turtle", "unicorn",
    "waffle", "walrus", "whale", "yak", "zebra"
]



def generate_slug():
    base = f"{random.choice(adjectives)}-{random.choice(nouns)}"
    suffix = str(random.randint(1, 99))
    return f"{base}-{suffix}"



from fastapi import FastAPI, Request, Response, Query
from typing import Optional

SITES_DIR = "/var/www/flowin-sites"
BASE_DOMAIN = "flowin.one"

@app.post("/publish")
async def publish(request: Request, slug: Optional[str] = Query(None)):
    html = await request.body()

    if slug:
        # validate slug format (e.g., only a-z, 0-9, dash)
        slug = slug.lower()
        if not all(c.isalnum() or c == '-' for c in slug):
            return Response("Invalid slug format", status_code=400)
        site_path = os.path.join(SITES_DIR, slug)
        if os.path.exists(site_path):
            return Response("Slug already taken", status_code=409)
    else:
        # auto-generate unique slug
        for _ in range(10):
            slug = generate_slug()
            site_path = os.path.join(SITES_DIR, slug)
            if not os.path.exists(site_path):
                break
        else:
            return Response("Could not generate unique slug", status_code=500)

    os.makedirs(site_path, exist_ok=False)
    with open(os.path.join(site_path, "index.html"), "wb") as f:
        f.write(html)

    return Response(content=f"https://{slug}.{BASE_DOMAIN}", media_type="text/plain")



import re

def extract_html_from_response(text: str) -> str:
    match = re.search(r"```(?:html)?\s*(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text



from openai import OpenAI
from pydantic import BaseModel

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
print("DEBUG: OpenAI key =", os.environ.get("OPENAI_API_KEY"))

class PromptInput(BaseModel):
    prompt: str

@app.post("/generate")
async def generate_html(input: PromptInput):
    system_msg = (
        "You are an expert web developer. "
        "Return a complete HTML5 site inside a single Markdown code block."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": input.prompt}
            ],
            temperature=0.7,
        )

        msg = response.choices[0].message.content
        html = extract_html_from_response(msg)
        return {"html": html}

    except Exception as e:
        return {"error": str(e)}
