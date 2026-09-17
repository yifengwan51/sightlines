window.SIGHTLINES_SCENARIOS = [
  {
    "id": "blocked-pathway",
    "category": "Physical Accessibility",
    "shortCategory": "Physical",
    "title": "Blocked Pathway",
    "shortDescription": "A delivery trolley is obstructing a shared route near the library. Inspect the scene, separate observation from assumption, and decide what to do first.",
    "skills": [
      "Barrier recognition",
      "Autonomy",
      "Respectful helping judgement",
      "Systemic action"
    ],
    "decisionPrompt": "What would you do first?",
    "choices": [
      {
        "text": "If it is safe and appropriate, move the trolley out of the shared route. Then, if support still seems relevant, ask whether any assistance is wanted and follow the person's stated preference.",
        "status": "Barrier-first, autonomy-supporting response",
        "type": "constructive",
        "routeKey": "barrier-first",
        "sceneResult": {
          "before": "Shared route partly blocked",
          "after": "Shared route reopened",
          "message": "The environmental barrier is addressed first. Any further assistance remains optional and can be guided by the person's stated preference."
        },
        "consequence": "The route becomes easier to use for everyone, including people you have not noticed. The student retains control over whether they want additional help. If moving the trolley is not safe or permitted, the same principle can guide you toward reporting or resolving the obstruction rather than automatically taking physical control of another person.",
        "explanation": "This approach treats the obstruction as the first problem to examine rather than treating the disabled person as the problem. It also separates barrier removal from personal assistance: removing a shared obstacle can improve access without presuming incapacity, while asking before helping allows the individual to accept, decline, or specify a preferred form of support. This is not a universal rule that you must personally move every object; safety, ownership and local procedures still matter. The transferable process is to recognise the barrier, address it where feasible, and preserve the person's autonomy.",
        "lenses": [
          "Barrier recognition",
          "Barrier removal",
          "Autonomy",
          "Individual preference",
          "Shared access"
        ],
        "notUniversal": "This is not a rule that you must personally move every obstruction. Safety, ownership and local procedures still matter. The transferable principle is to address the access barrier where feasible and preserve the person's choice."
      },
      {
        "text": "Immediately take the student's arm and guide them around the trolley so they can get past the obstruction quickly.",
        "status": "Assistance offered without consultation",
        "type": "risk",
        "routeKey": "physical-guidance",
        "sceneResult": {
          "before": "Shared route partly blocked",
          "after": "Person redirected; barrier remains",
          "message": "One person may get around the obstacle, but the obstruction stays in place and physical guidance was initiated without first checking preference."
        },
        "consequence": "The student may get around the trolley, but unexpected physical contact can be unwanted, disorienting, or unsafe. The original obstruction also remains for the next person who uses the route.",
        "explanation": "Assistance is relational rather than automatically beneficial. The concern is not that help must never be offered; it is that taking hold of someone assumes both that help is needed and that you know how it should be delivered. Asking first preserves control and allows the person to accept, decline, or describe a preferred form of support. In an immediate emergency the situation may require different judgement, but this scenario is a routine campus obstruction with time to avoid unnecessary physical control.",
        "lenses": [
          "Consent",
          "Physical contact",
          "Autonomy",
          "Respectful helping judgement"
        ],
        "notUniversal": "In an immediate emergency, circumstances can change what action is reasonable. This scenario is a routine campus obstruction, so there is time to avoid unnecessary physical control and ask first."
      },
      {
        "text": "Tell the student that a trolley is blocking the route, but leave it in place because they can navigate around it and someone else will probably move it later.",
        "status": "Useful information, incomplete barrier response",
        "type": "partial",
        "routeKey": "warning-only",
        "sceneResult": {
          "before": "Shared route partly blocked",
          "after": "Warning provided; barrier remains",
          "message": "The information may help this person in the moment, but the shared environmental barrier is unchanged."
        },
        "consequence": "The warning may be useful and avoids unwanted physical contact, but the access problem remains. The same barrier may affect this student again, another blind or low-vision person, a wheelchair user, someone carrying equipment, or anyone navigating the busy route.",
        "explanation": "Accessible communication can help in the immediate moment, but individual warnings are not always a substitute for changing an exclusionary environment. If the obstruction can be safely removed or reported, a barrier-level response can provide more durable access than asking each person to work around it. A warning may still be the best immediate action if moving the trolley would be unsafe or unauthorised; the key question is whether the response stops at an individual workaround when the environmental problem could also be addressed.",
        "lenses": [
          "Communication",
          "Barrier persistence",
          "Shared access",
          "Systemic action"
        ],
        "notUniversal": "A verbal warning may be the best immediate response if moving the trolley is unsafe or unauthorised. The key question is whether the response stops at an individual workaround when the environmental problem could also be addressed."
      }
    ],
    "reflection": {
      "question": "Which principle would you most want to carry into a similar real campus situation?",
      "options": [
        "Look for the environmental barrier before assuming the person is the problem.",
        "Ask before providing personal assistance when there is time to do so.",
        "Prefer solutions that improve shared access rather than only one-off workarounds.",
        "Balance barrier removal with situational safety and the person's autonomy."
      ],
      "prompt": "In one or two sentences, explain how you would balance barrier removal, safety and personal autonomy."
    },
    "type": "physical",
    "subtitle": "A routine obstruction becomes an accessibility decision.",
    "learningGoal": "Distinguish between addressing an environmental barrier and taking control of another person's movement.",
    "context": {
      "location": "Library pedestrian route",
      "time": "Late afternoon between classes",
      "role": "You are another student walking across campus.",
      "situation": "It is late afternoon during a busy class change near the university library. A delivery trolley has been left partly across a commonly used pedestrian route. A blind or low-vision student is approaching from the opposite direction while other students are also moving through the area. You can see the obstruction, but you do not know whether the student wants assistance, what form of assistance would be useful, or whether moving the trolley yourself is safe or permitted. Before acting, focus on what you can actually observe rather than what you might assume.",
      "whatIsKnown": [
        "The trolley is obstructing part of a shared route.",
        "The route is being used by multiple students.",
        "The student is travelling independently and has not requested help.",
        "The trolley appears to be the immediate environmental barrier."
      ],
      "whatIsUnknown": [
        "Whether the student wants assistance.",
        "What form of assistance, if any, would be useful.",
        "Whether moving the trolley yourself is safe or permitted in this context."
      ]
    },
    "observations": [
      {
        "id": "trolley",
        "label": "Inspect the delivery trolley",
        "title": "Environmental barrier",
        "text": "The trolley is occupying a substantial part of the shared pedestrian route and appears to be the immediate environmental barrier.",
        "lens": "Barrier recognition"
      },
      {
        "id": "pathway",
        "label": "Inspect the shared pathway",
        "title": "Shared access",
        "text": "The route has become significantly narrower, so the obstruction may affect multiple people rather than only the approaching student.",
        "lens": "Systemic action"
      },
      {
        "id": "student",
        "label": "Notice the approaching student",
        "title": "Preference is not observable",
        "text": "The student is travelling independently and has not asked for assistance. Their preferred way of navigating the situation is not visible to you.",
        "lens": "Autonomy"
      },
      {
        "id": "context",
        "label": "Check the wider context",
        "title": "Safety and feasibility",
        "text": "There is nearby space where the trolley might be moved, but safe and appropriate action still depends on the immediate context, ownership, and local procedures.",
        "lens": "Practical judgement"
      }
    ],
    "decisionNote": "There is no universal script. Consider the barrier, the person's autonomy, and what is safe and practical in this situation.",
    "takeaway": "Address the barrier where feasible; ask rather than assume; and let the person retain control over whether and how assistance is provided."
  },
  {
    "id": "image-only-event",
    "category": "Digital Accessibility",
    "shortCategory": "Digital",
    "title": "Image-Only Event Information",
    "shortDescription": "A visually polished student-club poster contains all important event details inside the image. Revise the public post and check what your changes actually fix.",
    "skills": [
      "Digital accessibility",
      "Barrier recognition",
      "Accessible communication",
      "Systemic action"
    ],
    "repairOptions": [
      {
        "id": "page-text",
        "label": "Add the essential date, time, venue, registration deadline and key schedule information as ordinary selectable page text.",
        "category": "public"
      },
      {
        "id": "alt-text",
        "label": "Add meaningful alternative text that identifies the event poster and points users to the complete event details already available as page text.",
        "category": "public"
      },
      {
        "id": "accessible-link",
        "label": "Replace the image-only registration instruction with a clearly labelled registration link that can be reached and understood from the page.",
        "category": "public"
      },
      {
        "id": "private-message",
        "label": "Send the event details privately to one blind or low-vision student who you think may need them.",
        "category": "individual"
      },
      {
        "id": "leave-unchanged",
        "label": "Leave the public post unchanged and rely on OCR or other students to explain the poster when necessary.",
        "category": "none"
      }
    ],
    "reflection": {
      "question": "What is the strongest design lesson from repairing this event post?",
      "options": [
        "Build accessibility into the original public material rather than waiting for individual requests.",
        "Use ordinary page text for essential information and use alternative text according to the image's purpose.",
        "Accessible formats can benefit users beyond the person you initially had in mind.",
        "A private workaround may help someone, but it does not automatically remove the public barrier."
      ],
      "prompt": "Name one change you would make to a real student-club post before publishing it."
    },
    "type": "digital",
    "subtitle": "Repair the public communication, not only the individual workaround.",
    "learningGoal": "Recognise why essential public information should be accessible at the source rather than only through private workarounds.",
    "context": {
      "location": "Student-club event page",
      "role": "You are helping your student club publish a public event announcement.",
      "situation": "Your student club is publishing a public announcement for Campus Music Night. The poster looks polished, but the date, time, venue, registration instructions and schedule are embedded inside the image. The page itself contains almost no useful text, and the image does not have meaningful alternative text. You do not know which assistive technologies individual visitors use, whether OCR will interpret the design accurately, or who else may benefit from selectable, searchable and scalable text. Your task is to improve the original public communication rather than guess who might need a separate version.",
      "whatIsKnown": [
        "The announcement is public and intended for the wider campus community.",
        "Essential event logistics are embedded in the poster image.",
        "The page contains almost no useful text.",
        "The image does not currently have meaningful alternative text."
      ],
      "whatIsUnknown": [
        "Which assistive technologies individual visitors use.",
        "Whether OCR will interpret the poster accurately.",
        "Which other visitors may benefit from selectable, searchable and scalable text."
      ]
    },
    "poster": {
      "title": "CAMPUS MUSIC NIGHT",
      "date": "Friday 18 September",
      "time": "7:00 PM - 9:30 PM",
      "venue": "Student Activity Hall A",
      "registration": "Registration closes Thursday 5:00 PM",
      "schedule": "Doors 6:30 PM · Performances 7:00 PM · Social session 8:45 PM"
    },
    "repairEvaluation": {
      "excellent": {
        "status": "Public accessibility substantially improved",
        "type": "constructive",
        "routeKey": "public-repair",
        "consequence": "The essential event information is available directly on the page and the image has a meaningful text alternative. Visitors are less dependent on OCR, another person's availability, or a separate request for access.",
        "explanation": "This response changes the original public communication instead of waiting for an individual to encounter the barrier. Visual design can remain, but essential logistics are also provided as accessible text. Alternative text supports the image's purpose without needing to become the only place where detailed schedules and deadlines live. The exact implementation depends on the page and image function, so accessibility should be checked as a complete user flow rather than reduced to one technical attribute.",
        "lenses": [
          "Digital accessibility",
          "Accessible communication",
          "Multiple formats",
          "Shared access",
          "Systemic action"
        ],
        "notUniversal": "Alternative text does not need to duplicate every word already available as nearby accessible text. Its purpose and level of detail should match the function of the image and surrounding page."
      },
      "goodText": {
        "status": "Core public information improved",
        "type": "constructive",
        "routeKey": "public-repair",
        "consequence": "The largest information barrier is reduced because essential event details are now available as ordinary page text. The poster itself still needs a meaningful text alternative, so the repair is useful but not complete.",
        "explanation": "Providing essential logistics as page text is a strong barrier-level response because the information becomes selectable, searchable and scalable. However, the image still has a communicative purpose, so its alternative text should also be considered. Accessibility is strongest when the page and the image work together rather than forcing one feature to carry the entire experience.",
        "lenses": [
          "Digital accessibility",
          "Barrier recognition",
          "Shared access",
          "Information structure"
        ],
        "notUniversal": "The exact implementation depends on the page design and the image's function. Accessibility should be checked as a complete user flow rather than reduced to one technical attribute."
      },
      "altOnly": {
        "status": "Partial repair: image described, information structure still weak",
        "type": "partial",
        "routeKey": "partial-public-repair",
        "consequence": "The poster has a text alternative, but detailed logistics still depend too heavily on an image description rather than being presented as ordinary page content.",
        "explanation": "Alternative text is useful, but a dense poster containing dates, schedules, deadlines and registration instructions is often better supported by putting essential information directly in the page. Alt text should complement accessible content, not become a replacement for an entire inaccessible information structure. Some images genuinely require detailed descriptions; here the main design problem is that essential public information was locked into a graphic.",
        "lenses": [
          "Alternative text",
          "Accessible communication",
          "Information structure"
        ],
        "notUniversal": "Some images genuinely need detailed descriptions. Here, the main problem is that important public event information has been embedded only in a graphic rather than being provided as ordinary page content."
      },
      "privateOnly": {
        "status": "Individual workaround only",
        "type": "partial",
        "routeKey": "private-workaround",
        "consequence": "One student may receive the information, but the public post still creates the same barrier for anyone else who visits it.",
        "explanation": "A private message can be helpful in the moment, but it places access outside the normal public communication channel and requires someone to identify who might need a separate version. Improving the original post is more scalable and preserves equal access to the same information source. Direct communication is not inherently wrong; the concern is using it as a substitute for fixing a public barrier that can reasonably be corrected.",
        "lenses": [
          "Individual workaround",
          "Public information",
          "Shared access",
          "Systemic action"
        ],
        "notUniversal": "Direct communication is not inherently wrong. The concern is using it as a substitute for fixing a public barrier that can reasonably be corrected."
      },
      "unchanged": {
        "status": "Public accessibility barrier remains",
        "type": "risk",
        "routeKey": "unchanged",
        "consequence": "Visitors must depend on OCR, another person, or extra effort to recover basic event information that could have been made directly available.",
        "explanation": "Assistive technologies are valuable, but they should not be treated as a reason to leave avoidable barriers in place. A public event post can be designed so that important information is available without requiring extra repair work from the user. No single format works for every person; the practical aim is to avoid unnecessarily locking essential information into one visual-only representation.",
        "lenses": [
          "Extra burden",
          "Accessible design",
          "Barrier persistence"
        ],
        "notUniversal": "No single format works for every person. The goal is not to predict every individual need, but to avoid unnecessarily locking essential information into one visual-only representation."
      }
    },
    "takeaway": "Keep the visual design if useful, but make essential information and actions accessible in the original public communication."
  },
  {
    "id": "group-activity",
    "category": "Interpersonal Accessibility",
    "shortCategory": "Interpersonal",
    "title": "The Visual Group Activity",
    "shortDescription": "A project group relies on pointing and visual shorthand. Respond before you know the group member's preference, then adapt after they tell you what would help.",
    "skills": [
      "Inclusive participation",
      "Communication",
      "Autonomy",
      "Shared responsibility"
    ],
    "firstChoices": [
      {
        "text": "Pause briefly, ask how the group member prefers visual information to be shared, and suggest that everyone describe what they are pointing to more clearly.",
        "followUpResponse": "“I can work with diagrams. What helps is when people name the part they mean instead of saying ‘this’ or ‘that’. I also use the shared file after the meeting, so clear labels help there too.”",
        "id": "ask-and-adapt",
        "followUpSpeaker": "Group member",
        "followUpNote": "You now have direct information about one person's preference instead of relying on assumptions."
      },
      {
        "text": "Suggest giving the blind or low-vision member a non-visual task such as note-taking so the rest of the group can continue using the diagram normally.",
        "followUpResponse": "“I do not want to be moved away from the diagram work. I can contribute to the structure; the difficult part is following visual references that are not described.”",
        "id": "separate-task",
        "followUpSpeaker": "Group member",
        "followUpNote": "The response shows why assigning a role based on assumed capability can create exclusion."
      },
      {
        "text": "Keep the discussion moving and tell the group member to interrupt whenever something is unclear.",
        "followUpResponse": "“I can ask questions, but if I have to stop the discussion every time someone says ‘this’ or ‘that’, I end up doing most of the work to repair the communication.”",
        "id": "ask-to-interrupt",
        "followUpSpeaker": "Group member",
        "followUpNote": "The group member can advocate for themselves, but the accessibility burden is being placed mainly on one person."
      }
    ],
    "secondChoices": [
      {
        "text": "Adopt clearer verbal references, add meaningful labels to the shared material, and keep checking the group member's stated preferences as the task changes.",
        "status": "Inclusive group practice",
        "type": "constructive",
        "routeKey": "shared-practice",
        "consequence": "The group keeps the member involved in the same academic task while improving communication practices that can reduce ambiguity for everyone.",
        "explanation": "This response combines individual consultation with a shared change in group practice. It does not assume that one accessibility technique will work in every situation, and it does not make the blind or low-vision member solely responsible for identifying every breakdown. The exact communication method should follow the person's preference and the task; the transferable principle is to ask, adapt and make access a shared responsibility.",
        "lenses": [
          "Inclusive participation",
          "Communication",
          "Shared responsibility",
          "Individual preference",
          "Autonomy"
        ],
        "id": "shared-practice",
        "notUniversal": "The exact communication method should follow the person's preference and the task. The transferable principle is to ask, adapt and make access a shared responsibility."
      },
      {
        "text": "Keep the visual workflow unchanged but formally assign the blind or low-vision member to notes, scheduling or another task that seems less visually demanding.",
        "status": "Participation restricted by assumption",
        "type": "risk",
        "routeKey": "separate-role",
        "consequence": "The group may feel more efficient in the short term, but the member is excluded from part of the substantive project work without that role change being based on their stated preference.",
        "explanation": "Automatically reallocating work can turn an access problem in the group process into a restriction on the person's participation. Inclusive planning asks what access is needed before deciding what someone can or cannot contribute. Task division is normal in group work; the concern is assigning roles because of an assumed limitation rather than skills, preference or an agreed division of labour.",
        "lenses": [
          "Participation",
          "Assumptions",
          "Autonomy",
          "Role allocation"
        ],
        "id": "separate-role",
        "notUniversal": "Task division is normal in group work. The concern is assigning roles because of an assumed limitation rather than skills, preference or an agreed division of labour."
      },
      {
        "text": "Continue with the same visual shorthand and remind the member that they should speak up whenever they miss something.",
        "status": "Accessibility burden shifted to the individual",
        "type": "partial",
        "routeKey": "individual-burden",
        "consequence": "The member can request clarification, but repeated access failures still have to be noticed and repaired by the person most affected by them.",
        "explanation": "Inviting questions is better than shutting them down, but it does not make the communication itself accessible. A group can proactively change recurring practices while still leaving room for individual preference and clarification. Self-advocacy can be important, but it should not be the only mechanism through which access is created.",
        "lenses": [
          "Shared responsibility",
          "Communication",
          "Participation",
          "Accessibility burden"
        ],
        "id": "individual-burden",
        "notUniversal": "Self-advocacy can be important, and people may choose to request clarification. The issue is making that the only mechanism through which access is created."
      }
    ],
    "reflection": {
      "question": "What is the strongest principle to carry into future group work?",
      "options": [
        "Ask about preferences instead of inferring capability from disability.",
        "Improve recurring group practices instead of relying on repeated individual requests.",
        "Keep the person involved in substantive work unless they choose a different role.",
        "Treat accessibility as an ongoing process of mutual accommodation."
      ],
      "prompt": "Describe one communication habit your own project group could change to make participation more inclusive."
    },
    "type": "interpersonal",
    "subtitle": "Inclusive participation depends on communication practice and individual preference.",
    "learningGoal": "Avoid excluding someone through assumptions while shifting accessibility from an individual burden to a shared group practice.",
    "context": {
      "location": "Project-team meeting room",
      "role": "You are one member of a four-person class project group.",
      "situation": "Your four-person project group is planning a class presentation around a shared diagram. The discussion is moving quickly. Several students point at the screen and use phrases such as ‘put this over there’, ‘use that box’, and ‘move the top-right part after this’. One group member is blind or has low vision. You know that much of the conversation currently depends on seeing what others are pointing at, but you do not yet know how this group member accesses diagrams, what adaptations they prefer, or whether the shared file itself is accessible outside the meeting.",
      "whatIsKnown": [
        "The discussion depends heavily on visual pointing and shorthand.",
        "The group is making substantive project decisions together.",
        "The blind or low-vision member has not yet been asked how they prefer visual information to be communicated."
      ],
      "whatIsUnknown": [
        "How the group member currently accesses diagrams.",
        "Which adaptations they find useful.",
        "Whether the shared file itself is accessible outside the meeting."
      ]
    },
    "dialogue": [
      {
        "speaker": "Alex",
        "text": "Put this part over there, beside the one in the top-right corner."
      },
      {
        "speaker": "Jamie",
        "text": "Yes, then connect this box to that one and move the other section down."
      },
      {
        "speaker": "You",
        "text": "You notice that much of the meaning is being carried by pointing rather than by words."
      }
    ],
    "firstDecisionPrompt": "What would you do at this point?",
    "secondDecisionPrompt": "You have new information. What should the group do next?",
    "takeaway": "Ask, listen and adapt the shared practice; do not solve an accessibility problem by automatically reducing someone's participation."
  }
];
