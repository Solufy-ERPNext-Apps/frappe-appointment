import { useFrappeGetDocList } from "frappe-react-sdk";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import z from "zod";
import { useFrappePostCall } from "frappe-react-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, ChevronLeft, CircleAlert, X, ChevronDown } from "lucide-react";
import { formatDate } from "date-fns";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import Typography from "@/components/typography";
import { useAppContext } from "@/context/app";
import {
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import Spinner from "@/components/spinner";

// Form schema using zod
const meetingFormSchema = z.object({
  chairperson: z.string().min(2, "Chairperson name must be at least 2 characters"),
  chairperson_id: z.string().optional(), // Optional chairperson_id
  host: z.string().email("Please enter a valid host email address"),
  participants: z.array(z.string().email("Please enter a valid email address")),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

interface MeetingFormProps {
  onBack: VoidFunction;
  onSuccess: (data: any) => void;
  durationId: string;
  isMobileView: boolean;
}

const MeetingForm = ({
  onBack,
  durationId,
  onSuccess,
  isMobileView,
}: MeetingFormProps) => {
  const [isParticipantsDropdownOpen, setIsParticipantsDropdownOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");
  const [isHostDropdownOpen, setIsHostDropdownOpen] = useState(false);
  // const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChairpersonDropdownOpen, setIsChairpersonDropdownOpen] = useState(false);
  const [chairpersonId, setChairpersonId] = useState<string | null>(null);
  const { call: bookMeeting, loading } = useFrappePostCall(
    `frappe_appointment.api.personal_meet.book_time_slot`
  );
  const [searchParams] = useSearchParams();

  const { selectedDate, selectedSlot, timeZone } = useAppContext();
  const { data: users, isLoading: usersLoading } =
  useFrappeGetDocList("User", {
    fields: ["name", "chairperson", "host"],
    filters: [["enabled", "=", 1]],
    limit: 100,
  });
  const userDocs =
  users?.map((user) => ({
    id: user.name, 
    name: user.chairperson || user.name,
    email: user.host,
  })) ||  [];

  const [existingChairpersons, setExistingChairpersons] = useState<
    { id: string; name: string }[]
  >([]);

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      chairperson: "",
      chairperson_id: "",
      host: "",
      participants: [],
    },
  });

  // Populate existingChairpersons on mount with selected chairperson
  useEffect(() => {
    const currentName = form.getValues("chairperson");
    const currentId = form.getValues("chairperson_id");
    if (currentName && currentId) {
      setExistingChairpersons((prev) => {
        if (!prev.find((p) => p.id === currentId)) {
          return [...prev, { id: currentId, name: currentName }];
        }
        return prev;
      });
      setChairpersonId(currentId);
    }
  }, []);

  // Merge existing chairpersons with userDocs to avoid duplicates in dropdown
  const mergedChairpersons = [
    ...existingChairpersons,
    ...userDocs.filter(
      (user) => !existingChairpersons.some((ec) => ec.id === user.id)
    ),
  ];

  // Handle adding participants on input keydown or blur
  const handleParticipantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addParticipant();
    }
  };

  const addParticipant = () => {
    const email = participantInput.trim();
    if (email && email.includes("@")) {
      const currentParticipants = form.getValues("participants");
      if (!currentParticipants.includes(email)) {
        form.setValue("participants", [...currentParticipants, email]);
        setParticipantInput("");
      }
    }
  };

  const removeParticipant = (email: string) => {
    const currentParticipants = form.getValues("participants");
    form.setValue(
      "participants",
      currentParticipants.filter((participant) => participant !== email)
    );
  };

  // Submit handler
  const onSubmit = (data: MeetingFormValues) => {
    const extraArgs: Record<string, string> = {};
    searchParams.forEach((value, key) => (extraArgs[key] = value));

    const meetingData = {
      ...extraArgs,
      duration_id: durationId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(getTimeZoneOffsetFromTimeZoneString(timeZone)),
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      chairperson_name: data.chairperson,
      chairperson_id: chairpersonId,
      host_email: data.host,
      user_name: data.chairperson,
      user_email: data.host,
      participants: data.participants.join(", "),
    };

    bookMeeting(meetingData)
      .then((data) => {
        onSuccess(data);
      })
      .catch((err) => {
        const error = parseFrappeErrorMsg(err);
        toast(error || "Something went wrong", {
          duration: 4000,
          classNames: {
            actionButton:
              "group-[.toast]:!bg-red-500 group-[.toast]:hover:!bg-red-300 group-[.toast]:!text-white",
          },
          icon: <CircleAlert className="h-5 w-5 text-red-500" />,
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      });
  };

  // Handle chairperson selection from dropdown
  const handleSelectChairperson = (user: { id: string; name: string }) => {
    form.setValue("chairperson", user.name);
    form.setValue("chairperson_id", user.id);
    setChairpersonId(user.id);

    setExistingChairpersons((prev) => {
      if (!prev.find((p) => p.id === user.id)) {
        return [...prev, user];
      }
      return prev;
    });

    setIsChairpersonDropdownOpen(false);
  };

  // Handle adding a new chairperson
  const handleAddNewChairperson = () => {
    setIsChairpersonDropdownOpen(false);
    toast("Add new chairperson feature is under development.");
  };

  return (
    <motion.div
      key={2}
      className={`w-full md:h-[31rem] lg:w-[41rem] shrink-0 md:p-6 md:px-4`}
      initial={isMobileView ? {} : { x: "100%" }}
      animate={{ x: 0 }}
      exit={isMobileView ? {} : { x: "100%" }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 h-full flex justify-between flex-col"
        >
          <div className="space-y-4">
            <div className="flex gap-3 max-md:flex-col md:items-center md:justify-between">
              <Typography variant="p" className="text-2xl">
                Meeting Schedule
              </Typography>
              <Typography className="text-sm mt-1 text-blue-500 dark:text-blue-400">
                <CalendarPlus className="inline-block w-4 h-4 mr-1 md:hidden" />
                {formatDate(selectedDate, "d MMM, yyyy")}
              </Typography>
            </div>

            {/* Chairperson field */}
            <FormField
              control={form.control}
              name="chairperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.chairperson ? "text-red-500" : ""
                    }`}
                  >
                    Chairperson{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        disabled={loading}
                        className="active:ring-blue-400 focus-visible:ring-blue-400"
                        placeholder="Select or Add Chairperson"
                        {...field}
                        // onClick={() => setIsDropdownOpen(true)}
                        onClick={() => setIsChairpersonDropdownOpen(true)}
                      />
                      <Button
                        type="button"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        // onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        onClick={() =>
                            setIsChairpersonDropdownOpen((v) => !v)
                          }
                        disabled={loading}
                      >
                        <ChevronDown />
                      </Button>
                      {isChairpersonDropdownOpen && (
                        <div className="absolute z-10 bg-white shadow-md border p-2 w-full mt-1 max-h-40 overflow-auto">
                          <ul>
                            {mergedChairpersons.length > 0 ? (
                              mergedChairpersons.map((user) => (
                                <li
                                  key={user.id}
                                  onClick={() => handleSelectChairperson(user)}
                                  className="cursor-pointer p-1 hover:bg-blue-100"
                                >
                                  {user.name}
                                </li>
                              ))
                            ) : (
                              <li className="cursor-not-allowed p-1 text-gray-500">
                                No internal users available
                              </li>
                            )}
                            <li
                              onClick={handleAddNewChairperson}
                              className="cursor-pointer p-1 text-blue-500 hover:bg-blue-100"
                            >
                              Add New Chairperson
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.chairperson ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            />

            {/* Host field */}
            {/* <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.host ? "text-red-500" : ""
                    }`}
                  >
                    Host{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      className={`active:ring-blue-400 focus-visible:ring-blue-400 ${
                        form.formState.errors.host
                          ? "active:ring-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                      placeholder="host@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.host ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            /> */}
             {/* Host field */}
            <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Host <span className="text-red-500"></span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            readOnly
                            placeholder="Select Host Email"
                            value={field.value || ""}
                            onClick={() => setIsHostDropdownOpen(true)}
                          />

                          <Button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={() => setIsHostDropdownOpen((v) => !v)}
                          >
                            <ChevronDown />
                          </Button>

                          {isHostDropdownOpen && (
                            <div className="absolute z-10 bg-white border shadow-md mt-1 w-full max-h-40 overflow-auto">
                              <ul>
                                {userDocs.map((user) => (
                                  <li
                                    key={user.id}
                                    onClick={() => {
                                      field.onChange(user.email); 
                                      setIsHostDropdownOpen(false);
                                    }}
                                    className="cursor-pointer p-2 hover:bg-blue-100"
                                  >
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

            {/* Participants field */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto hover:bg-blue-50 dark:hover:bg-blue-800/10 text-blue-500 dark:text-blue-400 hover:text-blue-600"
                onClick={() => setIsParticipantsDropdownOpen(!isParticipantsDropdownOpen)}
                disabled={loading}
              >
                {isParticipantsDropdownOpen ? "Hide Participants" : "+ Add Participants"}
              </Button>

              {isParticipantsDropdownOpen && (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      placeholder="janedoe@hotmail.com, bob@gmail.com, etc."
                      value={participantInput}
                      className="active:ring-blue-400 focus-visible:ring-blue-400"
                      onChange={(e) => setParticipantInput(e.target.value)}
                      onKeyDown={handleParticipantKeyDown}
                      onBlur={addParticipant}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      // onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      onClick={() =>
                        setIsParticipantsDropdownOpen((v) => !v)
                      }
                      disabled={loading}
                    >
                      <ChevronDown />
                    </Button>
                    {isParticipantsDropdownOpen && (
                      <div className="absolute z-10 bg-white shadow-md border p-2 w-full mt-1 max-h-40 overflow-auto">
                        <ul>
                          {userDocs?.map((user) => (
                            <li
                              key={user.id}
                              onClick={() => {
                                const current = form.getValues("participants");
                                if (!current.includes(user.email)) {
                                  form.setValue("participants", [
                                    ...current,
                                    user.email,
                                  ]);
                                }
                              }}
                              className="cursor-pointer p-1 hover:bg-blue-100"
                            >
                              {user.name}
                            </li>
                          ))}
                          <li
                            onClick={() => {
                              setIsChairpersonDropdownOpen(false);
                              addParticipant();
                            }}
                            className="cursor-pointer p-1 text-blue-500 hover:bg-blue-100"
                          >
                            Add New Participant
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("participants").map((participant) => (
                      <div
                        key={participant}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-500 dark:bg-blue-400 text-white dark:text-background rounded-full text-sm"
                      >
                        <span>{participant}</span>
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant)}
                          className="hover:text-blue-200"
                        >
                          <X className="h-3 w-3 dark:text-background" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between md:pt-4 max-md:h-14 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-screen max-md:border max-md:z-10 max-md:bg-background max-md:border-top max-md:items-center max-md:px-4">
            <Button
              type="button"
              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400 md:hover:bg-blue-50 md:dark:hover:bg-blue-800/10 max-md:px-0 max-md:hover:underline max-md:hover:bg-transparent"
              onClick={onBack}
              variant="ghost"
              disabled={loading}
            >
              <ChevronLeft /> Back
            </Button>
            <Button
              disabled={loading}
              className="bg-blue-500 dark:bg-blue-400 hover:bg-blue-500 dark:hover:bg-blue-400"
              type="submit"
            >
              {loading && <Spinner />} Schedule Meeting
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
};

export default MeetingForm;